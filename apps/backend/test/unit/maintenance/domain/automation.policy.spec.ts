import {
  describeLaunchdSchedule,
  launchdHealth,
  lastMeaningfulLine,
  parseLaunchctlPrint,
  summarizeReleaseDir,
} from '@/maintenance/domain/policies/automation.policy';
import type { LaunchdJobInfo } from '@/maintenance/domain/types/automation.type';

const none = {
  calendar: [],
  intervalSeconds: null,
  runAtLoad: false,
  keepAlive: false,
  launchOnlyOnce: false,
};

function job(overrides: Partial<LaunchdJobInfo> = {}): LaunchdJobInfo {
  return {
    label: 'com.example.job',
    domain: 'gui',
    program: 'job.sh',
    schedule: { ...none, intervalSeconds: 600 },
    loaded: true,
    running: false,
    lastExitCode: 0,
    logUpdatedAt: null,
    lastLogLine: null,
    ...overrides,
  };
}

describe('자동 작업 정책', () => {
  it('launchd 일정을 사람이 읽는 문장으로 바꾼다', () => {
    expect(
      describeLaunchdSchedule({ ...none, calendar: [{ hour: 4, minute: 23 }] }),
    ).toBe('매일 04:23');
    expect(
      describeLaunchdSchedule({
        ...none,
        calendar: [{ hour: 3, minute: 0, weekday: 1 }],
      }),
    ).toBe('매주 월요일 03:00');
    expect(describeLaunchdSchedule({ ...none, intervalSeconds: 600 })).toBe(
      '10분마다',
    );
    expect(describeLaunchdSchedule({ ...none, intervalSeconds: 1800 })).toBe(
      '30분마다',
    );
    expect(describeLaunchdSchedule({ ...none, intervalSeconds: 86400 })).toBe(
      '하루마다',
    );
    expect(
      describeLaunchdSchedule({ ...none, runAtLoad: true, keepAlive: true }),
    ).toBe('로그인하면 계속 실행');
    expect(describeLaunchdSchedule({ ...none, runAtLoad: true })).toBe(
      '로그인할 때 한 번',
    );
  });

  it('launchctl print 출력에서 실행 상태와 마지막 종료 코드를 읽는다', () => {
    expect(
      parseLaunchctlPrint(
        '\tstate = not running\n\truns = 12\n\tlast exit code = 0\n',
      ),
    ).toEqual({ running: false, lastExitCode: 0 });
    expect(
      parseLaunchctlPrint(
        '\tstate = running\n\tlast exit code = (never exited)\n',
      ),
    ).toEqual({ running: true, lastExitCode: null });
  });

  it('계속 떠 있어야 하는 작업과 정해진 때만 도는 작업을 다르게 판단한다', () => {
    const keepAlive = { ...none, runAtLoad: true, keepAlive: true };
    expect(launchdHealth(job({ loaded: false }))).toBe('stopped');
    expect(launchdHealth(job({ schedule: keepAlive, running: true }))).toBe(
      'ok',
    );
    expect(launchdHealth(job({ schedule: keepAlive, running: false }))).toBe(
      'failed',
    );
    expect(launchdHealth(job({ lastExitCode: 0 }))).toBe('ok');
    expect(launchdHealth(job({ lastExitCode: 1 }))).toBe('failed');
    expect(launchdHealth(job({ lastExitCode: null }))).toBe('unknown');
    expect(launchdHealth(job({ running: true }))).toBe('running');
  });

  it('로그인 때 한 번 도는 작업은 끝나 목록에서 빠져도 멈춘 것으로 보지 않는다', () => {
    const once = {
      ...none,
      runAtLoad: true,
      keepAlive: true,
      launchOnlyOnce: true,
    };

    expect(describeLaunchdSchedule(once)).toBe('로그인할 때 한 번');
    expect(launchdHealth(job({ schedule: once, loaded: false }))).toBe(
      'unknown',
    );
    expect(
      launchdHealth(
        job({ schedule: { ...none, runAtLoad: true }, loaded: false }),
      ),
    ).toBe('unknown');
    expect(launchdHealth(job({ schedule: once, lastExitCode: 0 }))).toBe('ok');
  });

  it('기록 끝에서 의미 있는 마지막 줄만 꺼내고 길면 자른다', () => {
    expect(
      lastMeaningfulLine('첫 줄\n\u001b[32m정상 종료\u001b[0m\n}\n\n'),
    ).toBe('정상 종료');
    expect(lastMeaningfulLine('\n\n')).toBeNull();
    expect(lastMeaningfulLine('가'.repeat(300))).toHaveLength(201);
  });

  it('릴리스 폴더가 남기는 기준을 넘으면 다음 배포 때 정리된다고 알려준다', () => {
    const config = {
      label: '배포 릴리스',
      container: 'app',
      path: '/releases',
      keep: 2,
    };
    const size = (bytes: number) => `${bytes}B`;

    expect(
      summarizeReleaseDir(
        config,
        { count: 2, sizeBytes: 10, lastDeployedAt: null },
        size,
      ),
    ).toEqual({ health: 'ok', message: '지금 2개 · 10B · 남기는 기준 2개' });
    expect(
      summarizeReleaseDir(
        config,
        { count: 3, sizeBytes: 10, lastDeployedAt: null },
        size,
      ).health,
    ).toBe('unknown');
  });
});
