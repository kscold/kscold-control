/** 밖에서 이 서버로 들어오는 길 하나의 상태 */
export interface RemoteAccessPath {
  id: 'tailscale' | 'orca-relay' | 'ssh-guard';
  label: string;
  /** ok: 쓸 수 있음, down: 끊김, unknown: 확인 못 함 */
  state: 'ok' | 'down' | 'unknown';
  detail: string | null;
}
