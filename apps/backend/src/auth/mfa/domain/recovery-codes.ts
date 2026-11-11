import { randomInt } from 'node:crypto';

export const RECOVERY_CODE_COUNT = 10;
const UNAMBIGUOUS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 12;
const GROUP_LENGTH = 4;

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from(
      { length: RECOVERY_CODE_LENGTH },
      () => UNAMBIGUOUS_ALPHABET[randomInt(UNAMBIGUOUS_ALPHABET.length)],
    ).join('');
    return chars.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-');
  });
}

export function normalizeRecoveryCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (compact.length !== RECOVERY_CODE_LENGTH) return null;
  for (const char of compact) {
    if (!UNAMBIGUOUS_ALPHABET.includes(char)) return null;
  }
  return compact;
}
