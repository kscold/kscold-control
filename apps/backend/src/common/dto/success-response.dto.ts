/**
 * Success Response DTO
 * Standard format for successful responses
 */
export class SuccessResponseDto<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;

  constructor(data: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }

  static create<T>(data: T, message?: string): SuccessResponseDto<T> {
    return new SuccessResponseDto(data, message);
  }

  static createSimple(message: string): SuccessResponseDto<null> {
    return new SuccessResponseDto(null, message);
  }
}

/**
 * Operation Success DTO
 * For simple success/failure operations (delete, update, etc.)
 */
export class OperationSuccessDto {
  success: boolean;
  message?: string;

  constructor(message?: string) {
    this.success = true;
    this.message = message;
  }

  static create(message?: string): OperationSuccessDto {
    return new OperationSuccessDto(message);
  }
}
