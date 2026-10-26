import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveComposeFilePath,
  resolveDockerProjectRoot,
} from '@/docker/infrastructure/lib/docker-project-root';

describe('로컬 전용 Compose 설정', () => {
  let root: string;
  const original = process.env.CONTROL_COMPOSE_FILE;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'control-compose-'));
    delete process.env.CONTROL_COMPOSE_FILE;
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    if (original === undefined) delete process.env.CONTROL_COMPOSE_FILE;
    else process.env.CONTROL_COMPOSE_FILE = original;
  });
  it('배포 설정을 커밋하지 않아도 애플리케이션 루트는 찾는다', () => {
    fs.mkdirSync(path.join(root, 'apps/backend/dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), '');
    fs.writeFileSync(path.join(root, 'apps/backend/package.json'), '{}');
    expect(resolveDockerProjectRoot(path.join(root, 'apps/backend/dist'))).toBe(
      root,
    );
  });
  it('로컬 Compose가 있으면 과거 기본 파일보다 우선한다', () => {
    fs.writeFileSync(
      path.join(root, 'docker-compose.local.yml'),
      'services: {}',
    );
    expect(resolveComposeFilePath(root)).toBe(
      path.join(root, 'docker-compose.local.yml'),
    );
  });
  it('환경 변수 경로는 절대 경로만 허용한다', () => {
    process.env.CONTROL_COMPOSE_FILE = './wrong-project.yml';
    expect(() => resolveComposeFilePath(root)).toThrow('절대 경로');
    process.env.CONTROL_COMPOSE_FILE = path.join(root, 'private.yml');
    expect(resolveComposeFilePath(root)).toBe(process.env.CONTROL_COMPOSE_FILE);
  });
});
