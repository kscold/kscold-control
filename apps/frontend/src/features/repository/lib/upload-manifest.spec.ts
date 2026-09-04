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

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
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

  it('선택 메타데이터와 실제 바이트가 달라도 읽은 바이트를 고정한다', async () => {
    let source = new TextEncoder().encode('current-content');
    const selected = {
      relativePath: 'src/changing.ts',
      file: {
        name: 'changing.ts',
        size: 3_465,
        type: 'text/plain',
        lastModified: 1,
        arrayBuffer: async () => Uint8Array.from(source).buffer,
      } as File,
    };

    const result = await buildUploadManifest([selected]);
    source = new TextEncoder().encode('changed-after-scan');
    const frozen = result.files[0];

    expect(frozen.metadata.size).toBe('current-content'.length);
    expect(frozen.clientFile.file.size).toBe('current-content'.length);
    const frozenContent = await readFile(frozen.clientFile.file);
    expect(new TextDecoder().decode(frozenContent)).toBe('current-content');
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
