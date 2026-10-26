import { useRef, useState } from 'react';
import { networkService } from '../api/network.service';
import { useModalStore } from '@/shared/model';
import { useAuthStore } from '@/shared/model/auth.store';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useNetworkQuery } from './useNetworkQuery';
import {
  emptyForm,
  type CreateMappingForm,
  type PortMapping,
} from '../model/network.types';

const fetchMappings = (signal: AbortSignal) =>
  networkService.getMappings(signal);
const mayWrite = () => {
  const { user, impersonation } = useAuthStore.getState();
  return (
    !impersonation &&
    !user?.impersonation &&
    Boolean(user?.permissions.includes(PERMISSIONS.SYSTEM_WRITE))
  );
};

export function usePortMappings() {
  const {
    data: mappings,
    loading,
    error,
    updatedAt,
    reload: loadMappings,
  } = useNetworkQuery<PortMapping[]>(fetchMappings, []);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateMappingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const mutation = useRef(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  useAuthStore((state) => state.user);
  useAuthStore((state) => state.impersonation);
  const canWrite = mayWrite();
  const canMutate =
    canWrite &&
    !loading &&
    !error &&
    Boolean(updatedAt) &&
    !submitting &&
    !deleting;

  const { showAlert, showConfirm } = useModalStore();

  const handleCreate = async () => {
    if (!mayWrite() || !canMutate || mutation.current) return;
    const pubPort = Number(form.publicPort);
    const privPort = Number(form.privatePort);

    if (
      !Number.isInteger(pubPort) ||
      !Number.isInteger(privPort) ||
      pubPort < 1 ||
      privPort < 1
    ) {
      showAlert('유효한 포트 번호를 입력하세요.');
      return;
    }
    if (pubPort > 65535 || privPort > 65535) {
      showAlert('포트 번호는 65535 이하여야 합니다.');
      return;
    }

    mutation.current = true;
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
      mutation.current = false;
      setSubmitting(false);
    }
  };

  const handleDelete = (mapping: PortMapping) => {
    if (!canMutate || mutation.current || !mayWrite()) return;
    showConfirm(
      `포트 매핑 ${mapping.publicPort} -> ${mapping.privatePort} (${mapping.protocol})을 삭제하시겠습니까?`,
      async () => {
        if (mutation.current || !mayWrite()) return;
        mutation.current = true;
        setDeleting(`${mapping.publicPort}-${mapping.protocol}`);
        try {
          await networkService.removeMapping(
            mapping.publicPort,
            mapping.protocol,
          );
          await loadMappings();
        } catch (e: any) {
          showAlert(e.message || '포트 매핑 삭제 실패');
        } finally {
          mutation.current = false;
          setDeleting(null);
        }
      },
      '삭제',
    );
  };

  const openModal = () => {
    if (!canMutate) return;
    setForm(emptyForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showAlert('클립보드에 복사되었습니다.');
    } catch {
      showAlert(
        '클립보드 접근이 차단됐습니다. IP 주소를 선택해서 직접 복사하세요.',
        '복사 실패',
      );
    }
  };

  return {
    mappings,
    loading,
    showModal,
    form,
    submitting,
    error,
    updatedAt,
    canWrite,
    canMutate,
    deleting,
    setForm,
    loadMappings,
    handleCreate,
    handleDelete,
    openModal,
    closeModal,
    copyToClipboard,
  };
}
