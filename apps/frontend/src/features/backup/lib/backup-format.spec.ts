import {
  buildRestoreCommand,
  describeRunOrigin,
  formatRelativeTime,
  formatRunDuration,
  getRunStatusPresentation,
  getTriggerLabel,
} from './backup-format';

describe('백업 표시 형식', () => {
  describe('실행 소요 시간', () => {
    it.each([
      ['2026-10-06T05:48:00.000Z', '2026-10-06T05:48:04.200Z', '4초'],
      ['2026-10-06T05:48:00.000Z', '2026-10-06T05:49:12.000Z', '1분 12초'],
      ['2026-10-06T05:48:00.000Z', '2026-10-06T05:50:00.000Z', '2분'],
      ['2026-10-06T05:48:00.000Z', '2026-10-06T05:48:00.300Z', '1초 미만'],
    ])('%s → %s 는 %s', (startedAt, finishedAt, expected) => {
      expect(formatRunDuration(startedAt, finishedAt)).toBe(expected);
    });

    it('아직 끝나지 않았거나 시각이 뒤집혀 있으면 비워 둔다', () => {
      expect(formatRunDuration('2026-10-06T05:48:00.000Z', null)).toBe('');
      expect(
        formatRunDuration(
          '2026-10-06T05:48:00.000Z',
          '2026-10-06T05:47:00.000Z',
        ),
      ).toBe('');
    });
  });

  describe('상대 시각', () => {
    const now = new Date('2026-10-06T06:00:00.000Z');

    it.each([
      ['2026-10-06T06:00:20.000Z', '곧'],
      ['2026-10-06T06:25:00.000Z', '25분 뒤'],
      ['2026-10-06T18:30:00.000Z', '13시간 뒤'],
      ['2026-10-09T06:00:00.000Z', '3일 뒤'],
      ['2026-10-06T05:59:40.000Z', '방금'],
      ['2026-10-06T05:48:00.000Z', '12분 전'],
      ['2026-10-05T18:30:00.000Z', '12시간 전'],
    ])('%s 는 %s', (value, expected) => {
      expect(formatRelativeTime(value, now)).toBe(expected);
    });

    it('해석할 수 없는 값은 비워 둔다', () => {
      expect(formatRelativeTime('not-a-date', now)).toBe('');
    });
  });

  it('실행 계기를 우리말로 보여준다', () => {
    expect(getTriggerLabel('schedule')).toBe('예약');
    expect(getTriggerLabel('manual')).toBe('수동');
  });

  it('수동 실행은 누가 실행했는지 함께 보여준다', () => {
    expect(
      describeRunOrigin({ trigger: 'manual', actorEmail: 'admin@example.com' }),
    ).toBe('수동 · admin@example.com');
    expect(describeRunOrigin({ trigger: 'manual', actorEmail: null })).toBe(
      '수동',
    );
    expect(describeRunOrigin({ trigger: 'schedule', actorEmail: null })).toBe(
      '예약',
    );
  });

  it('실행 상태마다 이름표가 있다', () => {
    expect(getRunStatusPresentation('running').label).toBe('실행 중');
    expect(getRunStatusPresentation('success').label).toBe('성공');
    expect(getRunStatusPresentation('failed').label).toBe('실패');
  });

  it('복원 명령에 접속 URI 를 적지 않고 환경변수로 받게 한다', () => {
    const command = buildRestoreCommand(
      '/backups/app-prod/2026-10-05_18-30-02',
      'mongo:7',
    );

    expect(command).toContain('docker run --rm -i -e MONGODB_URI mongo:7');
    expect(command).toContain('mongorestore --uri "$MONGODB_URI"');
    expect(command).toContain(
      '< "/backups/app-prod/2026-10-05_18-30-02/dump.archive.gz"',
    );
    expect(command).not.toContain('mongodb://');
  });
});
