/**
 * Error Response DTO
 * Standard format for error responses
 */
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

/**
 * Validation Error DTO
 * For validation errors with field-specific messages
 */
export class ValidationErrorDto extends ErrorResponseDto {
  constructor(errors: Record<string, string[]>) {
    super('VALIDATION_ERROR', 'Validation failed', errors);
  }
}
