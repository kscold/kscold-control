import { useState } from 'react';
import { useModalStore } from '../../../shared/model/modal.store';
import { nginxService } from '../../../services/api/nginx.service';

export function useNginxConfig() {
  const [testOutput, setTestOutput] = useState<{
    success: boolean;
    output: string;
  } | null>(null);
  const [reloading, setReloading] = useState(false);

  const { showAlert } = useModalStore();

  const handleTest = async () => {
    const data = await nginxService.testConfig();
    setTestOutput(data);
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const data = await nginxService.reloadNginx();
      if (data.success) {
        showAlert('Nginx가 성공적으로 리로드됐습니다.');
      } else {
        showAlert(`리로드 실패: ${data.output}`);
      }
    } finally {
      setReloading(false);
    }
  };

  return {
    testOutput,
    setTestOutput,
    reloading,
    handleTest,
    handleReload,
  };
}
