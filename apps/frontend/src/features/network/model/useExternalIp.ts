import { networkService } from '../api/network.service';
import { useNetworkQuery } from './useNetworkQuery';

const fetchExternalIp = (signal: AbortSignal) =>
  networkService.getExternalIp(signal);

export function useExternalIp() {
  return useNetworkQuery(fetchExternalIp, '');
}
