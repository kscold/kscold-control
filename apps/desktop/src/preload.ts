import { contextBridge, ipcRenderer } from 'electron';

// 설치 화면이 쓸 수 있는 기능만 좁게 연다.
contextBridge.exposeInMainWorld('installer', {
  check: () => ipcRenderer.invoke('wizard:check'),
  openDockerInstall: () => ipcRenderer.invoke('wizard:open-docker-install'),
  chooseDir: () => ipcRenderer.invoke('wizard:choose-dir'),
  install: (answers: unknown) => ipcRenderer.invoke('wizard:install', answers),
  finish: () => ipcRenderer.invoke('wizard:finish'),
  onProgress: (
    listener: (progress: { step: string; state: string }) => void,
  ) => {
    ipcRenderer.on('wizard:progress', (_event, progress) => listener(progress));
  },
});
