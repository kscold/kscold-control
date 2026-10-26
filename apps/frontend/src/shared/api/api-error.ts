/** 요청 본문·헤더 없이 진단에 필요한 상태만 보존함. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
