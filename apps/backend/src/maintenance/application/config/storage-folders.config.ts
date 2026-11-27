import os from 'node:os';
import path from 'node:path';
import type { StorageFolderDefinition } from '../../domain/types/storage.type';

/** 어느 맥에서나 커지기 쉬운 폴더 — 개발 도구가 버전·세션마다 쌓아 두는 곳 */
function defaultFolders(home: string): StorageFolderDefinition[] {
  return [
    {
      key: 'codex-sessions',
      label: 'Codex 대화 기록',
      description: '오래 이어 쓴 세션 하나가 수백 MB까지 커짐',
      path: path.join(home, '.codex/sessions'),
    },
    {
      key: 'codex-packages',
      label: 'Codex 실행 파일',
      description: '업데이트할 때마다 이전 버전이 남음',
      path: path.join(home, '.codex/packages'),
    },
    {
      key: 'claude-projects',
      label: 'Claude Code 대화 기록',
      description: '프로젝트별 세션 기록',
      path: path.join(home, '.claude/projects'),
    },
    {
      key: 'claude-versions',
      label: 'Claude Code 실행 파일',
      description: '업데이트할 때마다 이전 버전이 남음',
      path: path.join(home, '.local/share/claude/versions'),
    },
    {
      key: 'pnpm-store',
      label: 'pnpm 패키지 저장소',
      description: '여러 프로젝트가 나눠 쓰는 패키지 원본',
      path: path.join(home, 'Library/pnpm'),
    },
    {
      key: 'playwright',
      label: 'Playwright 브라우저',
      description: 'Playwright 버전마다 브라우저가 따로 깔림',
      path: path.join(home, 'Library/Caches/ms-playwright'),
    },
    {
      key: 'vscode-server',
      label: 'VS Code 원격 서버',
      description: '접속한 VS Code 버전마다 서버가 따로 깔림',
      path: path.join(home, '.vscode-server'),
    },
    {
      key: 'trash',
      label: '휴지통',
      description: '비우기 전까지 공간을 그대로 차지함',
      path: path.join(home, '.Trash'),
    },
    {
      key: 'tmp',
      label: '임시 폴더',
      description: '맥을 다시 시작하면 비워짐',
      path: '/private/tmp',
    },
  ];
}

/**
 * 이 맥에만 있는 폴더는 STORAGE_EXTRA_FOLDERS에 JSON 배열로 더한다.
 * 예: [{"label":"이관 백업","path":"~/.config/app/backups","description":"최신 하나만 남김"}]
 */
export function storageFolders(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): StorageFolderDefinition[] {
  const folders = defaultFolders(home);
  if (!env.STORAGE_EXTRA_FOLDERS) return folders;
  try {
    const extras = JSON.parse(env.STORAGE_EXTRA_FOLDERS) as Array<
      Partial<StorageFolderDefinition>
    >;
    extras.forEach((extra, index) => {
      if (!extra.label || !extra.path) return;
      folders.push({
        key: extra.key ?? `extra-${index + 1}`,
        label: extra.label,
        description: extra.description ?? '',
        path: extra.path.startsWith('~/')
          ? path.join(home, extra.path.slice(2))
          : extra.path,
      });
    });
  } catch {
    // 설정을 잘못 적어도 기본 목록은 보여준다
  }
  return folders;
}
