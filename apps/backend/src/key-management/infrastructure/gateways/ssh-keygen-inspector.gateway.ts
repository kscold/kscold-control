import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  InspectedSshKey,
  ISshKeyInspector,
} from '../../domain/gateways/ssh-key-inspector.gateway.interface';

const run = promisify(execFile);

/** ssh-keygen 으로 개인 키를 읽는다. 임시 파일은 소유자만 읽을 수 있고 바로 지운다. */
@Injectable()
export class SshKeygenInspectorGateway implements ISshKeyInspector {
  async inspect(privateKey: string): Promise<InspectedSshKey | null> {
    const directory = await mkdtemp(path.join(tmpdir(), 'ssh-key-vault-'));
    const privatePath = path.join(directory, 'key');
    const publicPath = path.join(directory, 'key.pub');

    try {
      await writeFile(privatePath, privateKey, { mode: 0o600 });
      const { stdout: publicKey } = await run('ssh-keygen', [
        '-y',
        '-P',
        '',
        '-f',
        privatePath,
      ]);
      await writeFile(publicPath, publicKey, { mode: 0o600 });
      const { stdout: listed } = await run('ssh-keygen', [
        '-l',
        '-f',
        publicPath,
      ]);
      const fingerprint = listed.trim().split(/\s+/)[1];
      return fingerprint ? { publicKey: publicKey.trim(), fingerprint } : null;
    } catch {
      // 오류 출력에 키 내용이 섞이지 않도록 원인은 전달하지 않는다.
      return null;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
