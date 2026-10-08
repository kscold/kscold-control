import { uploadSessionResponse } from '@/repository/presentation/dto/upload-session-response';
import type { RepositoryUploadSession } from '@/repository/domain/types/upload-session.type';

describe('uploadSessionResponse', () => {
  const session = {
    id: 'test-session',
    status: 'uploading',
    manifestDigest: 'sha256:hash',
    batches: [
      {
        index: 0,
        status: 'completed',
        totalFiles: 1,
        uploadedCount: 1,
        files: [{ relativePath: 'src/example.ts', size: 4, sha256: 'hash' }],
      },
    ],
  } as RepositoryUploadSession;

  it('진행률 응답에서 전체 manifest를 반복 전송하지 않는다', () => {
    const summary = uploadSessionResponse(session, 'true');
    expect(summary.batches[0]).not.toHaveProperty('files');
    expect(summary.batches[0]).toMatchObject({
      index: 0,
      uploadedCount: 1,
      totalFiles: 1,
    });
    expect(summary.manifestDigest).toBe(session.manifestDigest);
    expect(session.batches[0].files).toHaveLength(1);
  });

  it('기존 API 소비자가 요청하는 원본 응답은 유지한다', () => {
    expect(uploadSessionResponse(session)).toBe(session);
  });
});
