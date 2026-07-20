/** 성공 응답의 표준 형식이다. */
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

/** 삭제·수정처럼 성공 여부만 알리면 되는 단순 작업용 응답이다. */
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
