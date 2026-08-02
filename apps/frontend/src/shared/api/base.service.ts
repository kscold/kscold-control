import { AxiosError } from 'axios';

/**
 * 모든 API 서비스가 공통으로 쓰는 에러 처리와 유틸리티를 제공하는 기반 클래스
 */
/**
 * 서버 에러 응답에서 사용자에게 보여줄 메시지를 뽑는다.
 *
 * 백엔드(NestJS)는 { statusCode, message, error } 형태로 응답하며
 * - message: 문자열 (도메인 예외 메시지)
 * - message: 문자열 배열 (ValidationPipe 검증 실패)
 * - error: 상태 문구 문자열 ('Bad Request' 등)
 * 이다. 과거에는 존재하지 않는 error.message 를 읽어 항상 실패했고,
 * 그 결과 사용자에게 axios 기본 문구("Request failed with status code 400")만
 * 노출돼 원인을 알 수 없었다.
 */
function extractServerMessage(error: AxiosError): string | null {
  const data = error.response?.data as
    | { message?: unknown; error?: unknown }
    | undefined;
  if (!data) return null;

  if (typeof data.message === 'string' && data.message) return data.message;
  if (Array.isArray(data.message) && data.message.length > 0) {
    return data.message.filter((m) => typeof m === 'string').join(', ');
  }
  if (typeof data.error === 'string' && data.error) return data.error;
  return null;
}

export class BaseApiService {
  /**
   * API 에러를 일관된 방식으로 처리한다
   * @param error Axios 에러
   * @param defaultMessage 기본 에러 메시지
   * @throws 상황에 맞는 메시지를 담은 Error
   */
  protected handleError(error: unknown, defaultMessage: string): never {
    if (error instanceof AxiosError) {
      throw new Error(
        extractServerMessage(error) || error.message || defaultMessage,
      );
    }

    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error(defaultMessage);
  }

  /**
   * API 응답에서 에러 메시지를 추출한다
   * @param error 에러 객체
   * @returns 에러 메시지 문자열
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return extractServerMessage(error) || error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred';
  }

  /**
   * 디버깅용으로 에러를 로깅한다
   * @param context 서비스 이름
   * @param method 메서드 이름
   * @param error 에러 객체
   */
  protected logError(context: string, method: string, error: unknown): void {
    console.error(`[${context}] ${method} failed:`, error);
  }
}
