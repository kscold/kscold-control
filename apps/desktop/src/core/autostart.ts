import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface LoginItemApi {
  setLoginItemSettings(settings: { openAtLogin: boolean; openAsHidden?: boolean }): void;
}

const LINUX_ENTRY = 'kscold-control.desktop';

/**
 * 로그인할 때 앱을 켤지 정한다. macOS·윈도우는 Electron 기능을 쓰고,
 * 리눅스는 XDG 자동 시작 폴더에 실행 항목을 둔다.
 */
export function setStartAtLogin(
  enabled: boolean,
  app: LoginItemApi,
  executable: string,
  platform: NodeJS.Platform = process.platform,
  home = os.homedir(),
) {
  if (platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
    return;
  }
  const directory = path.join(home, '.config', 'autostart');
  const entry = path.join(directory, LINUX_ENTRY);
  if (!enabled) {
    if (existsSync(entry)) rmSync(entry);
    return;
  }
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    entry,
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=kscold-control',
      `Exec="${executable}" --hidden`,
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n'),
  );
}
