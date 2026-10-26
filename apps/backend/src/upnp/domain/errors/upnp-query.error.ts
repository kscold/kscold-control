export class UpnpQueryError extends Error {
  constructor(readonly code: 'UPNP_UNAVAILABLE' | 'UPNP_QUERY_FAILED') {
    super(
      code === 'UPNP_UNAVAILABLE'
        ? 'UPnP 게이트웨이에 연결할 수 없습니다. 공유기 설정과 서버의 네트워크 연결을 확인한 뒤 다시 시도하세요.'
        : '공유기 응답을 확인하지 못했습니다. 잠시 후 다시 조회하거나 공유기 관리 화면에서 확인하세요.',
    );
    this.name = 'UpnpQueryError';
  }
}
