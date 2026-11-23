import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DesktopConfig } from './config';

/** 설정 파일. 비밀 키가 들어 있어 본인만 읽을 수 있게 둔다. */
export class ConfigStore {
  constructor(private readonly filePath: string) {}

  read(): DesktopConfig | null {
    if (!existsSync(this.filePath)) return null;
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as DesktopConfig;
  }

  write(config: DesktopConfig) {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(config, null, 2), { mode: 0o600 });
    // 윈도우는 POSIX 권한이 없어 무시된다(사용자 프로필 폴더 권한을 따른다).
    if (process.platform !== 'win32') chmodSync(this.filePath, 0o600);
  }

  /** 첫 기동에서 관리자 계정을 만든 뒤 평문 비밀번호를 지운다. */
  clearPendingAdminPassword() {
    const config = this.read();
    if (!config?.pendingAdminPassword) return;
    delete config.pendingAdminPassword;
    this.write(config);
  }
}
