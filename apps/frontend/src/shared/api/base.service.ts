import { AxiosError } from 'axios';

/**
 * Base API Service
 * Provides common error handling and utility methods for all services
 */
export class BaseApiService {
  /**
   * Handle API errors consistently
   * @param error Axios error
   * @param defaultMessage Default error message
   * @throws Error with appropriate message
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
   * Extract error message from API response
   * @param error Error object
   * @returns Error message string
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
   * Log error for debugging
   * @param context Service context
   * @param method Method name
   * @param error Error object
   */
  protected logError(context: string, method: string, error: unknown): void {
    console.error(`[${context}] ${method} failed:`, error);
  }
}
