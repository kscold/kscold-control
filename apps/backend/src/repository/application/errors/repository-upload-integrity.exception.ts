import { BadRequestException } from '@nestjs/common';

export const REPOSITORY_UPLOAD_INTEGRITY_ERROR_CODE =
  'REPOSITORY_UPLOAD_INTEGRITY_MISMATCH';

export class RepositoryUploadIntegrityException extends BadRequestException {
  constructor(message: string) {
    super({
      code: REPOSITORY_UPLOAD_INTEGRITY_ERROR_CODE,
      message,
    });
  }
}
