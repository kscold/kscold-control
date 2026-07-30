/**
 * 컨테이너 노드 렌더링에 쓰이는 표시용 유틸
 */

/** 바이트 단위 메모리를 사람이 읽기 쉬운 문자열로 변환한다 */
export function formatMemory(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb.toFixed(0)}M`;
}

/** PM2 프로세스 상태에 대응하는 표시등 색상 클래스를 돌려준다 */
export function pm2Dot(status: string) {
  if (status === 'online') return 'bg-green-400 shadow-green-400/50 shadow-sm';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-400 shadow-red-400/50 shadow-sm';
}
