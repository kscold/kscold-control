export { OnlinePill, RemoteTargets } from './ui/RemoteTargets';
export { TargetDialog, type TargetDialogMode } from './ui/TargetDialog';
export {
  LOCAL_TARGET,
  addressOf,
  needsCredentials,
  protocolOf,
  type Target,
} from './model/remote-desktop.types';
export { useRemoteTargets, wakeLabel } from './model/useRemoteTargets';
export {
  debounce,
  fitScale,
  keysymForChar,
  keysymForKey,
  remoteSizeFor,
  toRemotePoint,
} from './lib/display-fit';
export type { TouchMode } from './lib/rdp-client';

// RDP 클라이언트는 필요할 때만 따로 내려받도록 동적 import 로 감싼다.
export const loadRdpClient = () => import('./lib/rdp-client');
