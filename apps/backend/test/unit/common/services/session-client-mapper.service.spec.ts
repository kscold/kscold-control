import { SessionClientMapper } from '@/common/services/session-client-mapper.service';

class TestSessionMapper extends SessionClientMapper {}

describe('SessionClientMapper', () => {
  let mapper: TestSessionMapper;

  beforeEach(() => {
    mapper = new TestSessionMapper();
  });

  it('클라이언트를 세션에 연결하고 양방향으로 조회한다', () => {
    mapper.mapClientToSession('client-1', 'session-1');
    mapper.mapClientToSession('client-2', 'session-1');

    expect(mapper.getSessionId('client-1')).toBe('session-1');
    expect(mapper.getClients('session-1')).toEqual(
      new Set(['client-1', 'client-2']),
    );
    expect(mapper.hasClients('session-1')).toBe(true);
  });

  it('마지막 클라이언트가 나가면 세션 항목까지 정리한다', () => {
    mapper.mapClientToSession('client-1', 'session-1');
    mapper.mapClientToSession('client-2', 'session-1');

    mapper.unmapClient('client-1');
    expect(mapper.getClients('session-1')).toEqual(new Set(['client-2']));

    mapper.unmapClient('client-2');
    expect(mapper.getClients('session-1')).toBeUndefined();
    expect(mapper.hasClients('session-1')).toBe(false);
  });

  it('등록되지 않은 클라이언트 해제는 아무 일도 하지 않는다', () => {
    expect(() => mapper.unmapClient('unknown')).not.toThrow();
    expect(mapper.getSessionId('unknown')).toBeUndefined();
  });

  it('세션을 비우면 소속 클라이언트 매핑도 함께 사라진다', () => {
    mapper.mapClientToSession('client-1', 'session-1');
    mapper.mapClientToSession('client-2', 'session-1');

    mapper.clearSession('session-1');

    expect(mapper.getClients('session-1')).toBeUndefined();
    expect(mapper.getSessionId('client-1')).toBeUndefined();
    expect(mapper.getSessionId('client-2')).toBeUndefined();
  });

  it('인스턴스가 다르면 세션 맵이 섞이지 않는다(모듈 간 격리)', () => {
    class OtherSessionMapper extends SessionClientMapper {}
    const other = new OtherSessionMapper();

    mapper.mapClientToSession('client-1', 'session-1');

    expect(other.getSessionId('client-1')).toBeUndefined();
    expect(other.getClients('session-1')).toBeUndefined();
    expect(mapper.getSessionId('client-1')).toBe('session-1');
  });
});
