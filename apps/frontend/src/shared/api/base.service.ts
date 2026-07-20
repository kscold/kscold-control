import { AxiosError } from 'axios';

/**
 * 모든 API 서비스가 공통으로 쓰는 에러 처리와 유틸리티를 제공하는 기반 클래스
 */
export class BaseApiService {
  /**
   * API 에러를 일관된 방식으로 처리한다
   * @param error Axios 에러
   * @param defaultMessage 기본 에러 메시지
   * @throws 상황에 맞는 메시지를 담은 Error
   */
  protected handleError(error: unknown, defaultMessage: string): never {
    if (error instanceof AxiosError) {
      const apiError = error.response?.data?.error;
      const message = apiError?.message || error.message || defaultMessage;
      throw new Error(message);
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
      return error.response?.data?.error?.message || error.message;
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
