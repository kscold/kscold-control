import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUploadSessionRequestDto } from '@/repository/presentation/dto/request/create-upload-session.request.dto';

const sha256 = 'a'.repeat(64);

function validPayload() {
  return {
    protocolVersion: 2,
    replace: true,
    totalFiles: 1,
    totalBytes: 4,
    filteredCount: 0,
    manifestDigest: `sha256:${'b'.repeat(64)}`,
    batches: [
      {
        index: 0,
        totalFiles: 1,
        totalBytes: 4,
        files: [{ relativePath: 'src/index.ts', size: 4, sha256 }],
      },
    ],
  };
}

async function validatePayload(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreateUploadSessionRequestDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateUploadSessionRequestDto', () => {
  it('v2 중첩 manifest 요청을 허용한다', async () => {
    await expect(validatePayload(validPayload())).resolves.toHaveLength(0);
  });

  it('구형 프로토콜과 잘못된 중첩 SHA를 거부한다', async () => {
    const payload = validPayload();
    payload.protocolVersion = 1;
    payload.batches[0].files[0].sha256 = 'not-a-sha';

    const errors = await validatePayload(payload);

    expect(errors.map((error) => error.property)).toContain('protocolVersion');
    expect(errors.map((error) => error.property)).toContain('batches');
  });

  it('허용하지 않은 최상위와 중첩 필드를 거부한다', async () => {
    const payload = {
      ...validPayload(),
      trustedByClient: true,
    };
    Object.assign(payload.batches[0].files[0], { absolutePath: '/etc/passwd' });

    const errors = await validatePayload(payload);

    expect(errors.map((error) => error.property)).toContain('trustedByClient');
    expect(errors.map((error) => error.property)).toContain('batches');
  });
});
