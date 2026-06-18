import { useState } from 'react';
import { networkService } from '../../../services/api/network.service';
import { useModalStore } from '../../../shared/model';
import {
  emptyForm,
  type CreateMappingForm,
  type PortMapping,
} from '../lib/network.types';

export function usePortMappings() {
  const [mappings, setMappings] = useState<PortMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateMappingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const { showAlert, showConfirm } = useModalStore();

  const loadMappings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await networkService.getMappings();
      setMappings(data);
    } catch (e: any) {
      const msg = e.message || 'UPnP 조회 실패';
      setError(msg);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (_externalIp: string) => {
    const pubPort = parseInt(form.publicPort, 10);
    const privPort = parseInt(form.privatePort, 10);

    if (!pubPort || !privPort || pubPort < 1 || privPort < 1) {
      showAlert('유효한 포트 번호를 입력하세요.');
      return;
    }
    if (pubPort > 65535 || privPort > 65535) {
      showAlert('포트 번호는 65535 이하여야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      await networkService.addMapping({
        publicPort: pubPort,
        privatePort: privPort,
        protocol: form.protocol,
        description: form.description || 'kscold-control',
      });
      showAlert(
        `포트 매핑 추가 완료: ${pubPort} -> ${privPort} (${form.protocol})`,
      );
      setShowModal(false);
      setForm(emptyForm);
      await loadMappings();
    } catch (e: any) {
      showAlert(e.message || '포트 매핑 추가 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (mapping: PortMapping) => {
    showConfirm(
      `포트 매핑 ${mapping.publicPort} -> ${mapping.privatePort} (${mapping.protocol})을 삭제하시겠습니까?`,
      async () => {
        try {
          await networkService.removeMapping(
            mapping.publicPort,
            mapping.protocol,
          );
          await loadMappings();
        } catch (e: any) {
          showAlert(e.message || '포트 매핑 삭제 실패');
        }
      },
      '삭제',
    );
  };

  const openModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showAlert('클립보드에 복사되었습니다.');
  };

  return {
    mappings,
    loading,
    showModal,
    form,
    submitting,
    error,
    setForm,
    loadMappings,
    handleCreate,
    handleDelete,
    openModal,
    closeModal,
    copyToClipboard,
  };
}
