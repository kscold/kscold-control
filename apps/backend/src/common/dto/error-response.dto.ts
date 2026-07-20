/** 에러 응답의 표준 형식이다. */
export class ErrorResponseDto {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;

  constructor(code: string, message: string, details?: any) {
    this.success = false;
    this.error = {
      code,
      message,
      details,
    };
    this.timestamp = new Date().toISOString();
  }

  static create(
    code: string,
    message: string,
    details?: any,
  ): ErrorResponseDto {
    return new ErrorResponseDto(code, message, details);
  }

  static fromException(exception: Error, code?: string): ErrorResponseDto {
    return new ErrorResponseDto(
      code || 'INTERNAL_SERVER_ERROR',
      exception.message,
      process.env.NODE_ENV === 'development' ? exception.stack : undefined,
    );
  }
}

/** 필드별 오류 메시지를 담는 검증 실패 응답이다. */
export class ValidationErrorDto extends ErrorResponseDto {
  constructor(errors: Record<string, string[]>) {
    super('VALIDATION_ERROR', 'Validation failed', errors);
  }
}
