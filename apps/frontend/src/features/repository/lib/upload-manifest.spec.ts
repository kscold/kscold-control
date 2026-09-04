import { webcrypto } from 'node:crypto';
import { buildUploadManifest } from './upload-manifest';
import type { ClientFile } from '@/entities/project';

function clientFile(relativePath: string, content: string): ClientFile {
  const bytes = new TextEncoder().encode(content);
  return {
    relativePath,
    file: {
      name: relativePath.split('/').at(-1) ?? 'file.txt',
      size: bytes.byteLength,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    } as File,
  };
}

describe('buildUploadManifest', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
      });
    }
  });

  it('경로와 크기가 같아도 파일 내용이 바뀌면 digest가 달라진다', async () => {
    const first = await buildUploadManifest([
      clientFile('src/index.ts', 'safe'),
    ]);
    const second = await buildUploadManifest([
      clientFile('src/index.ts', 'evil'),
    ]);

    expect(first.digest).not.toBe(second.digest);
    expect(first.files[0].metadata.size).toBe(second.files[0].metadata.size);
  });

  it('브라우저 파일 선택 순서와 무관하게 같은 digest를 만든다', async () => {
    const first = clientFile('a.txt', 'a');
    const second = clientFile('b.txt', 'b');

    await expect(buildUploadManifest([first, second])).resolves.toMatchObject({
      digest: (await buildUploadManifest([second, first])).digest,
    });
  });

  it('중복 상대 경로를 거부한다', async () => {
    await expect(
      buildUploadManifest([
        clientFile('same.txt', 'one'),
        clientFile('same.txt', 'two'),
      ]),
    ).rejects.toThrow('중복 파일 경로');
  });

  it('서버와 공유하는 코드 단위 경로 정렬 및 UTF-8 digest를 유지한다', async () => {
    const result = await buildUploadManifest([
      clientFile('ä.txt', 'ä'),
      clientFile('a/file.txt', 'a'),
      clientFile('Z.txt', 'z'),
    ]);

    expect(result.digest).toBe(
      'sha256:2bf4d6471395e7af13d8d3c3ffd533cf9211126fe7a226c6f8422c3acd94ad70',
    );
  });
});
