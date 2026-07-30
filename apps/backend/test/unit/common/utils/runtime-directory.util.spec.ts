import {
  DEFAULT_HOME_DIRECTORY,
  getHomeDirectory,
  getWorkingDirectory,
} from '@/common/utils/runtime-directory.util';

describe('runtime-directory.util', () => {
  const originalHome = process.env.HOME;
  const originalWorkingDir = process.env.CLAUDE_WORKING_DIR;

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;

    if (originalWorkingDir === undefined) delete process.env.CLAUDE_WORKING_DIR;
    else process.env.CLAUDE_WORKING_DIR = originalWorkingDir;
  });

  it('HOME 이 있으면 그대로 쓴다', () => {
    process.env.HOME = '/home/tester';
    expect(getHomeDirectory()).toBe('/home/tester');
  });

  it('HOME 이 비어 있으면 폴백을 쓴다', () => {
    delete process.env.HOME;
    expect(getHomeDirectory()).toBe(DEFAULT_HOME_DIRECTORY);
  });

  it('CLAUDE_WORKING_DIR 이 있으면 작업 디렉토리로 쓴다', () => {
    process.env.HOME = '/home/tester';
    process.env.CLAUDE_WORKING_DIR = '/workspace/project';
    expect(getWorkingDirectory()).toBe('/workspace/project');
  });

  it('CLAUDE_WORKING_DIR 이 없으면 홈 디렉토리로 폴백한다', () => {
    process.env.HOME = '/home/tester';
    delete process.env.CLAUDE_WORKING_DIR;
    expect(getWorkingDirectory()).toBe('/home/tester');
  });
});
