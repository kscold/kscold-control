import { describe, expect, it } from 'vitest';
import { isNewlyIssuedCert } from '@/nginx/domain/policies/cert-issuance.policy';

const startedAt = Date.parse('2026-11-23T06:00:00Z');

describe('isNewlyIssuedCert', () => {
  it('인증서가 없으면 새로 발급되지 않은 것으로 본다', () => {
    expect(isNewlyIssuedCert(null, null, startedAt)).toBe(false);
  });

  it('지문이 이전과 같으면 certbot 이 실패해 예전 인증서가 남은 것으로 본다', () => {
    const cert = { fingerprint256: 'AA', validFrom: '2026-11-23T05:30:00Z' };
    expect(isNewlyIssuedCert(cert, 'AA', startedAt)).toBe(false);
  });

  it('지문이 달라도 시작 시각이 오래됐으면 예전 인증서로 본다', () => {
    const cert = { fingerprint256: 'BB', validFrom: '2026-09-01T00:00:00Z' };
    expect(isNewlyIssuedCert(cert, 'AA', startedAt)).toBe(false);
  });

  it("Let's Encrypt 가 1시간 앞당긴 시작 시각도 새 인증서로 인정한다", () => {
    const cert = { fingerprint256: 'BB', validFrom: '2026-11-23T05:00:00Z' };
    expect(isNewlyIssuedCert(cert, 'AA', startedAt)).toBe(true);
  });

  it('처음 발급이면 이전 지문이 없어도 새 인증서로 본다', () => {
    const cert = { fingerprint256: 'BB', validFrom: '2026-11-23T05:10:00Z' };
    expect(isNewlyIssuedCert(cert, null, startedAt)).toBe(true);
  });
});
