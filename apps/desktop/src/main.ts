import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from 'electron';
import type { ChildProcess } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { setStartAtLogin } from './runtime/autostart';
import {
  buildBackendEnv,
  createConfig,
  validateAnswers,
  type InstallAnswers,
} from './runtime/config';
import { ConfigStore } from './runtime/config-store';
import {
  checkDocker,
  dockerInstallUrl,
  ensureDatabase,
  waitForDatabase,
} from './runtime/docker';
import {
  findFreePort,
  runNodeScript,
  startBackend,
  waitForHealth,
} from './runtime/backend';
import { withToolPaths } from './runtime/path-env';
import type { InstallStep } from './wizard/steps';

// docker 명령과 백엔드가 쓰는 도구를 찾을 수 있게 가장 먼저 PATH 를 보강한다.
process.env.PATH = withToolPaths(process.env.PATH);

const store = new ConfigStore(
  path.join(app.getPath('userData'), 'config.json'),
);
const logDir = path.join(app.getPath('userData'), 'logs');
// 설치본은 resources/control, 저장소에서 실행할 때는 저장소 루트를 쓴다.
const controlRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'control')
  : path.resolve(__dirname, '..', '..', '..');

let backend: ChildProcess | null = null;
let tray: Tray | null = null;
let wizard: BrowserWindow | null = null;
let status: 'starting' | 'running' | 'stopped' | 'error' = 'stopped';
let lastError = '';
let quitting = false;
let restartDelayMs = 2_000;

function controlUrl() {
  const config = store.read();
  return config ? `http://localhost:${config.port}` : null;
}

async function startControl(
  report: (step: InstallStep, state: 'run' | 'done') => void = () => {},
) {
  const config = store.read();
  if (!config) throw new Error('설정이 없습니다. 설치를 다시 해 주세요.');
  status = 'starting';
  refreshTray();

  report('docker', 'run');
  const docker = await checkDocker();
  if (docker.state !== 'ready') {
    throw new Error(
      docker.state === 'not-installed'
        ? 'Docker 가 설치되어 있지 않습니다.'
        : `Docker 가 켜져 있지 않습니다. Docker 를 켠 뒤 다시 시도해 주세요. ${docker.detail}`,
    );
  }
  report('docker', 'done');

  report('database', 'run');
  await ensureDatabase(config);
  await waitForDatabase();
  report('database', 'done');

  const env = buildBackendEnv(config, { controlRoot });
  const processOptions = {
    nodeBinary: process.execPath,
    cwd: path.join(controlRoot, 'apps', 'backend'),
    env,
    logFile: path.join(logDir, 'control.log'),
  };

  report('migrate', 'run');
  // 설치본은 pg 를 찾을 수 있게 마이그레이션 스크립트를 백엔드 폴더 안에 둔다.
  const migrateScript = app.isPackaged
    ? path.join(
        controlRoot,
        'apps',
        'backend',
        'scripts',
        'migrate-control-db.mjs',
      )
    : path.join(controlRoot, 'scripts', 'migrate-control-db.mjs');
  await runNodeScript(migrateScript, [], {
    ...processOptions,
    env: {
      ...env,
      CONTROL_MIGRATIONS_DIR: path.join(
        controlRoot,
        'apps',
        'backend',
        'migrations',
      ),
    },
  });
  report('migrate', 'done');

  report('server', 'run');
  launchBackend(processOptions);
  await waitForHealth(config.port);
  // 관리자 계정은 첫 기동에서 만들어졌으므로 평문 비밀번호를 지운다.
  store.clearPendingAdminPassword();
  report('server', 'done');
  status = 'running';
  restartDelayMs = 2_000;
  refreshTray();
}

function launchBackend(options: Parameters<typeof startBackend>[1]) {
  backend = startBackend(
    path.join(controlRoot, 'apps', 'backend', 'dist', 'main.js'),
    options,
  );
  backend.on('exit', (code) => {
    backend = null;
    if (quitting) return;
    // 예기치 않게 꺼지면 점점 늦춰 가며 다시 켠다.
    status = 'error';
    lastError = `서버가 종료되었습니다(코드 ${code}). ${restartDelayMs / 1000}초 뒤 다시 켭니다.`;
    refreshTray();
    setTimeout(() => {
      if (quitting) return;
      const config = store.read();
      if (!config) return;
      launchBackend({
        ...options,
        env: buildBackendEnv(config, { controlRoot }),
      });
      status = 'running';
      refreshTray();
    }, restartDelayMs);
    restartDelayMs = Math.min(restartDelayMs * 2, 60_000);
  });
}

function stopBackend() {
  return new Promise<void>((resolve) => {
    if (!backend) return resolve();
    const child = backend;
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

const STATUS_LABEL = {
  starting: '켜는 중…',
  running: '실행 중',
  stopped: '꺼짐',
  error: '문제 있음',
};

function trayImage() {
  const image = nativeImage.createFromPath(
    path.join(__dirname, 'wizard', 'tray.png'),
  );
  if (process.platform === 'darwin') image.setTemplateImage(true);
  return image;
}

function refreshTray() {
  if (!tray) return;
  const config = store.read();
  tray.setToolTip(`kscold-control · ${STATUS_LABEL[status]}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `kscold-control · ${STATUS_LABEL[status]}`, enabled: false },
      ...(status === 'error' && lastError
        ? [{ label: lastError, enabled: false }]
        : []),
      { type: 'separator' },
      {
        label: 'Control 열기',
        enabled: status === 'running',
        click: () => {
          const url = controlUrl();
          if (url) void shell.openExternal(url);
        },
      },
      {
        label: '다시 시작',
        click: async () => {
          quitting = true;
          await stopBackend();
          quitting = false;
          await startControl().catch(showStartError);
        },
      },
      { label: '로그 폴더 열기', click: () => void shell.openPath(logDir) },
      {
        label: '로그인할 때 켜기',
        type: 'checkbox',
        checked: config?.startAtLogin ?? false,
        click: (item) => {
          if (!config) return;
          setStartAtLogin(item.checked, app, process.execPath);
          store.write({ ...config, startAtLogin: item.checked });
        },
      },
      { type: 'separator' },
      { label: '끝내기', click: () => app.quit() },
    ]),
  );
}

function showStartError(error: unknown) {
  status = 'error';
  lastError = error instanceof Error ? error.message : String(error);
  refreshTray();
  dialog.showErrorBox('kscold-control 을 켜지 못했습니다', lastError);
}

function openWizard() {
  wizard = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: false,
    title: 'kscold-control 설치',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  wizard.setMenuBarVisibility(false);
  void wizard.loadFile(path.join(__dirname, 'wizard', 'index.html'));
  wizard.on('closed', () => {
    wizard = null;
  });
}

function registerWizardIpc() {
  ipcMain.handle('wizard:check', async () => ({
    platform: process.platform,
    docker: await checkDocker(),
    dockerInstallUrl: dockerInstallUrl(process.platform),
    defaults: {
      port: await findFreePort(4000),
      dataDir: path.join(os.homedir(), 'kscold-control'),
    },
  }));

  ipcMain.handle('wizard:open-docker-install', () =>
    shell.openExternal(dockerInstallUrl(process.platform)),
  );

  ipcMain.handle('wizard:choose-dir', async () => {
    const result = await dialog.showOpenDialog(wizard!, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('wizard:install', async (_event, answers: InstallAnswers) => {
    const problems = validateAnswers(answers);
    if (problems.length > 0) return { ok: false, error: problems.join('\n') };
    try {
      const config = createConfig(answers, await findFreePort(55432));
      store.write(config);
      setStartAtLogin(answers.startAtLogin, app, process.execPath);
      await startControl((step, state) =>
        wizard?.webContents.send('wizard:progress', { step, state }),
      );
      ensureTray();
      return { ok: true, url: controlUrl() };
    } catch (error) {
      status = 'error';
      lastError = error instanceof Error ? error.message : String(error);
      return { ok: false, error: lastError };
    }
  });

  ipcMain.handle('wizard:finish', () => {
    const url = controlUrl();
    if (url) void shell.openExternal(url);
    wizard?.close();
  });
}

function ensureTray() {
  if (tray) return;
  tray = new Tray(trayImage());
  refreshTray();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (wizard) wizard.focus();
    else {
      const url = controlUrl();
      if (url && status === 'running') void shell.openExternal(url);
    }
  });

  app.whenReady().then(async () => {
    registerWizardIpc();
    // 메뉴 막대 앱으로만 둔다(설치 마법사 창은 따로 뜬다).
    if (process.platform === 'darwin') app.dock?.hide();
    if (!store.read()) {
      if (process.platform === 'darwin') void app.dock?.show();
      openWizard();
      return;
    }
    ensureTray();
    try {
      await startControl();
      const url = controlUrl();
      if (url && !process.argv.includes('--hidden'))
        void shell.openExternal(url);
    } catch (error) {
      showStartError(error);
    }
  });

  // 창을 닫아도 트레이에서 계속 돈다.
  app.on('window-all-closed', () => undefined);

  app.on('before-quit', (event) => {
    if (quitting || !backend) return;
    event.preventDefault();
    quitting = true;
    void stopBackend().then(() => app.quit());
  });
}
