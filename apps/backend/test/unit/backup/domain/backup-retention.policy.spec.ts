import {
  formatBackupTimestamp,
  parseBackupTimestamp,
  selectExpiredBackups,
} from '@/backup/domain/policies/backup-retention.policy';

describe('백업 보관 규칙', () => {
  const now = new Date('2026-10-20T00:00:00.000Z');

  it('백업 시각을 UTC 기준 디렉터리 이름으로 바꾸고 다시 읽는다', () => {
    const takenAt = new Date('2026-10-06T18:30:05.000Z');

    expect(formatBackupTimestamp(takenAt)).toBe('2026-10-06_18-30-05');
    expect(parseBackupTimestamp('2026-10-06_18-30-05')).toEqual(takenAt);
  });

  it.each([
    'dump_2026-10-06',
    '2026-10-06',
    '2026-02-31_00-00-00',
    '2026-10-06_25-00-00',
    '../2026-10-06_18-30-05',
    'last-run.json',
  ])('형식이 다른 이름 %s 은 백업 시각으로 읽지 않는다', (name) => {
    expect(parseBackupTimestamp(name)).toBeNull();
  });

  it('보관 기간이 지난 백업만 고른다', () => {
    const names = [
      '2026-10-09_18-30-00',
      '2026-10-19_18-30-00',
      '2026-09-01_18-30-00',
      '2026-10-10_18-30-00',
    ];

    expect(selectExpiredBackups(names, 10, now)).toEqual([
      '2026-10-09_18-30-00',
      '2026-09-01_18-30-00',
    ]);
  });

  it('가장 최근 백업은 보관 기간이 지났어도 남긴다', () => {
    const names = ['2026-07-01_00-00-00', '2026-08-01_00-00-00'];

    expect(selectExpiredBackups(names, 10, now)).toEqual([
      '2026-07-01_00-00-00',
    ]);
    expect(selectExpiredBackups(['2026-07-01_00-00-00'], 10, now)).toEqual([]);
  });

  it('백업 시각 형식이 아닌 이름은 고르지 않는다', () => {
    const names = [
      'dump_old',
      'last-run.json',
      '2026-01-01_00-00-00',
      '2026-10-19_00-00-00',
    ];

    expect(selectExpiredBackups(names, 10, now)).toEqual([
      '2026-01-01_00-00-00',
    ]);
  });
});
