import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { setStartAtLogin } from './autostart';

describe('로그인할 때 켜기', () => {
  it('macOS·윈도우는 Electron 로그인 항목을 쓴다', () => {
    const app = { setLoginItemSettings: vi.fn() };
    setStartAtLogin(true, app, '/Applications/Control.app', 'darwin');
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, openAsHidden: true });
  });

  it('리눅스는 자동 시작 항목을 만들고 끄면 지운다', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'autostart-'));
    const app = { setLoginItemSettings: vi.fn() };
    const entry = path.join(home, '.config', 'autostart', 'kscold-control.desktop');

    setStartAtLogin(true, app, '/opt/control/control', 'linux', home);
    expect(readFileSync(entry, 'utf8')).toContain('Exec="/opt/control/control" --hidden');

    setStartAtLogin(false, app, '/opt/control/control', 'linux', home);
    expect(existsSync(entry)).toBe(false);
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });
});
