// Let's Encrypt 는 인증서 시작 시각을 발급보다 1시간 앞당겨 적으므로 넉넉히 2시간을 본다.
const ISSUE_CLOCK_SLACK_MS = 2 * 60 * 60_000;

export interface IssuedCertFacts {
  fingerprint256: string;
  validFrom: string;
}

/**
 * 이번 실행에서 새 인증서가 나왔는지 판단함.
 * 예전 인증서가 남아 있으면 복사는 성공하므로, 지문이 바뀌었고 시작 시각도 최근이어야 새 것으로 본다.
 */
export function isNewlyIssuedCert(
  cert: IssuedCertFacts | null,
  previousFingerprint: string | null,
  startedAt: number,
): boolean {
  if (!cert || cert.fingerprint256 === previousFingerprint) return false;
  const validFrom = new Date(cert.validFrom).getTime();
  return (
    Number.isFinite(validFrom) && validFrom >= startedAt - ISSUE_CLOCK_SLACK_MS
  );
}
