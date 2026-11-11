/** 국가 코드를 국기 이모지로. 두 글자 코드가 아니면 빈 문자열 */
export function flagEmoji(country: string | null | undefined): string {
  if (!country || !/^[A-Z]{2}$/.test(country)) return '';
  return String.fromCodePoint(
    ...[...country].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}
