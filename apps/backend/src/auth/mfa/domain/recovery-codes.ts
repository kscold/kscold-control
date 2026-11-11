import { randomInt } from 'node:crypto';

export const RECOVERY_CODE_COUNT = 10;
/** 손으로 옮겨 적을 때 헷갈리는 0·O·1·I 를 뺀 32글자 */
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 12;
const GROUP_LENGTH = 4;

/** `ABCD-EFGH-JKMN` 꼴의 일회용 복구 코드 10개 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from(
      { length: RECOVERY_CODE_LENGTH },
      () => RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)],
    ).join('');
    return chars.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-');
  });
}

/** 입력한 복구 코드를 비교용 형태로 바꾼다. 복구 코드 꼴이 아니면 null */
export function normalizeRecoveryCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (compact.length !== RECOVERY_CODE_LENGTH) return null;
  for (const char of compact) {
    if (!RECOVERY_CODE_ALPHABET.includes(char)) return null;
  }
  return compact;
}
