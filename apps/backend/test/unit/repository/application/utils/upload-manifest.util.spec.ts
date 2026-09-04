import {
  buildUploadManifestDigest,
  hashUploadBuffer,
} from '@/repository/application/utils/upload-manifest.util';

describe('upload manifest contract', () => {
  it('브라우저와 공유하는 코드 단위 경로 정렬 및 UTF-8 digest를 유지한다', () => {
    const files = [
      { relativePath: 'ä.txt', content: 'ä' },
      { relativePath: 'a/file.txt', content: 'a' },
      { relativePath: 'Z.txt', content: 'z' },
    ].map(({ relativePath, content }) => {
      const buffer = Buffer.from(content);
      return {
        relativePath,
        size: buffer.length,
        sha256: hashUploadBuffer(buffer),
      };
    });

    expect(buildUploadManifestDigest(files)).toBe(
      'sha256:2bf4d6471395e7af13d8d3c3ffd533cf9211126fe7a226c6f8422c3acd94ad70',
    );
  });
});
