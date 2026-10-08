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
  it('운영 실패 규모인 26204개 파일, 543개 배치, 815999047바이트를 허용한다', async () => {
    const payload = validPayload();
    payload.totalFiles = 26204;
    payload.totalBytes = 815999047;
    payload.filteredCount = 55174;
    const files = Array.from({ length: payload.totalFiles }, (_, i) => ({
      relativePath: `src/file-${i}.ts`,
      size:
        Math.floor(payload.totalBytes / payload.totalFiles) +
        (i < payload.totalBytes % payload.totalFiles ? 1 : 0),
      sha256,
    }));
    payload.batches = Array.from({ length: 543 }, (_, index) => {
      const batch = files.slice(
        Math.floor((index * files.length) / 543),
        Math.floor(((index + 1) * files.length) / 543),
      );
      return {
        index,
        totalFiles: batch.length,
        totalBytes: batch.reduce((sum, f) => sum + f.size, 0),
        files: batch,
      };
    });
    await expect(validatePayload(payload)).resolves.toHaveLength(0);
  });

  it('새 한도를 초과하면 사용자에게 읽을 수 있는 이유를 반환한다', async () => {
    const errors = await validatePayload({
      ...validPayload(),
      totalFiles: 100001,
    });
    expect(
      errors.find((e) => e.property === 'totalFiles')?.constraints?.max,
    ).toContain('100000');
  });

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
