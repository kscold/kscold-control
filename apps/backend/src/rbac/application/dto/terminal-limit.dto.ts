/**
 * 터미널 명령 사용 현황 응답 DTO
 */
export class TerminalCommandStatusDto {
  allowed: boolean;
  remaining: number; // -1이면 무제한
  current?: number;
  limit?: number;
}
