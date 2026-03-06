import { useState } from 'react';
import { networkService } from '../../../services/api/network.service';

export function useExternalIp() {
  const [externalIp, setExternalIp] = useState<string>('');

  const loadExternalIp = async () => {
    try {
      setExternalIp(await networkService.getExternalIp());
    } catch (e) {
      console.error('External IP fetch failed', e);
    }
  };

  return { externalIp, loadExternalIp };
}
