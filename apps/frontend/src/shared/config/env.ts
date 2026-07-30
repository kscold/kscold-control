/**
 * 프론트엔드 실행 환경 설정.
 * 빌드 타임에 주입되는 Vite 환경변수를 한 곳에서만 읽는다.
 */

/** API 서버 기본 URL — 값이 없으면 같은 오리진으로 요청한다 */
export const API_URL = import.meta.env.VITE_API_URL || '';
