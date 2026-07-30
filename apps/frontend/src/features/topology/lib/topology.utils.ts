/**
 * 컨테이너 노드 렌더링에 쓰이는 표시용 유틸
 */

/** PM2 프로세스 상태에 대응하는 표시등 색상 클래스를 돌려준다 */
export function pm2Dot(status: string) {
  if (status === 'online') return 'bg-green-400 shadow-green-400/50 shadow-sm';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-400 shadow-red-400/50 shadow-sm';
}
