import {
  isScheduledBackupDue,
  isValidBackupScheduleTime,
  latestScheduledOccurrence,
  resolveNextRunAt,
} from '@/backup/domain/policies/backup-schedule.policy';

describe('백업 예약 규칙', () => {
  it.each(['00:00', '03:30', '23:59'])('실행 시각 %s 은 허용한다', (time) => {
    expect(isValidBackupScheduleTime(time)).toBe(true);
  });

  it.each(['', '3:30', '24:00', '12:60', '12:5', '03:30:00', 'ab:cd'])(
    '실행 시각 %p 은 거부한다',
    (time) => {
      expect(isValidBackupScheduleTime(time)).toBe(false);
    },
  );

  describe('가장 최근에 지나간 예약 시각', () => {
    it('오늘 예약 시각이 지났으면 오늘 것을 돌려준다', () => {
      // KST 2026-10-06 15:00 → 오늘 03:30 KST = UTC 10-05 18:30
      const now = new Date('2026-10-06T06:00:00.000Z');

      expect(latestScheduledOccurrence('03:30', now)).toEqual(
        new Date('2026-10-05T18:30:00.000Z'),
      );
    });

    it('오늘 예약 시각이 아직이면 어제 것을 돌려준다', () => {
      // KST 2026-10-06 02:00 → 어제 03:30 KST = UTC 10-04 18:30
      const now = new Date('2026-10-05T17:00:00.000Z');

      expect(latestScheduledOccurrence('03:30', now)).toEqual(
        new Date('2026-10-04T18:30:00.000Z'),
      );
    });

    it('예약 시각 정각에는 방금 도래한 시각을 돌려준다', () => {
      const now = new Date('2026-10-05T18:30:00.000Z');

      expect(latestScheduledOccurrence('03:30', now)).toEqual(now);
    });

    it('UTC 로는 전날인 새벽 시간대도 KST 날짜로 계산한다', () => {
      // KST 2026-11-01 00:10 (UTC 로는 10-31 15:10), 예약 00:05
      const now = new Date('2026-10-31T15:10:00.000Z');

      expect(latestScheduledOccurrence('00:05', now)).toEqual(
        new Date('2026-10-31T15:05:00.000Z'),
      );
    });

    it('형식이 틀린 시각은 오류로 알린다', () => {
      expect(() => latestScheduledOccurrence('25:00', new Date())).toThrow(
        '예약 시각 형식',
      );
    });
  });

  describe('예약 실행 차례', () => {
    const scheduleTime = '03:30';
    // 예약 시각: UTC 10-05 18:30 (KST 10-06 03:30)
    const occurrence = new Date('2026-10-05T18:30:00.000Z');

    it('예약 시각이 기준 시각 뒤에 도래했으면 차례다', () => {
      const state = {
        enabled: true,
        scheduleTime,
        scheduleCursorAt: new Date('2026-10-05T10:00:00.000Z'),
      };

      expect(isScheduledBackupDue(state, occurrence)).toBe(true);
      expect(
        isScheduledBackupDue(state, new Date('2026-10-05T18:31:00.000Z')),
      ).toBe(true);
    });

    it('예약 시각이 아직 오지 않았으면 차례가 아니다', () => {
      const state = {
        enabled: true,
        scheduleTime,
        scheduleCursorAt: new Date('2026-10-05T10:00:00.000Z'),
      };

      expect(
        isScheduledBackupDue(state, new Date('2026-10-05T18:29:00.000Z')),
      ).toBe(false);
    });

    it('이미 실행해 기준 시각이 옮겨졌으면 같은 예약 시각을 되풀이하지 않는다', () => {
      const state = {
        enabled: true,
        scheduleTime,
        scheduleCursorAt: occurrence,
      };

      expect(
        isScheduledBackupDue(state, new Date('2026-10-05T18:31:00.000Z')),
      ).toBe(false);
      // 다음 날 예약 시각에는 다시 차례가 된다.
      expect(
        isScheduledBackupDue(state, new Date('2026-10-06T18:30:00.000Z')),
      ).toBe(true);
    });

    it('예약 시각이 지난 뒤에 등록한 대상은 다음 날까지 기다린다', () => {
      const state = {
        enabled: true,
        scheduleTime,
        // KST 10-06 15:00 에 등록
        scheduleCursorAt: new Date('2026-10-06T06:00:00.000Z'),
      };

      expect(
        isScheduledBackupDue(state, new Date('2026-10-06T06:01:00.000Z')),
      ).toBe(false);
      expect(
        isScheduledBackupDue(state, new Date('2026-10-06T18:30:00.000Z')),
      ).toBe(true);
    });

    it('서버가 내려가 예약 시각을 놓쳤어도 다시 올라오면 차례가 된다', () => {
      const state = {
        enabled: true,
        scheduleTime,
        scheduleCursorAt: new Date('2026-10-04T18:30:00.000Z'),
      };

      // 예약 시각에서 다섯 시간 지난 뒤
      expect(
        isScheduledBackupDue(state, new Date('2026-10-05T23:30:00.000Z')),
      ).toBe(true);
    });

    it('사용하지 않는 대상은 차례가 오지 않는다', () => {
      const state = {
        enabled: false,
        scheduleTime,
        scheduleCursorAt: new Date('2026-10-01T00:00:00.000Z'),
      };

      expect(isScheduledBackupDue(state, occurrence)).toBe(false);
    });
  });

  describe('다음 실행 시각', () => {
    it('오늘 실행을 마쳤으면 내일 예약 시각이다', () => {
      const state = {
        enabled: true,
        scheduleTime: '03:30',
        scheduleCursorAt: new Date('2026-10-05T18:30:00.000Z'),
      };

      expect(
        resolveNextRunAt(state, new Date('2026-10-06T06:00:00.000Z')),
      ).toEqual(new Date('2026-10-06T18:30:00.000Z'));
    });

    it('차례가 돌아왔는데 아직 실행 전이면 지나간 그 예약 시각이다', () => {
      const state = {
        enabled: true,
        scheduleTime: '03:30',
        scheduleCursorAt: new Date('2026-10-04T18:30:00.000Z'),
      };

      expect(
        resolveNextRunAt(state, new Date('2026-10-05T18:30:20.000Z')),
      ).toEqual(new Date('2026-10-05T18:30:00.000Z'));
    });

    it('사용하지 않는 대상은 다음 실행이 없다', () => {
      const state = {
        enabled: false,
        scheduleTime: '03:30',
        scheduleCursorAt: new Date('2026-10-04T18:30:00.000Z'),
      };

      expect(resolveNextRunAt(state, new Date())).toBeNull();
    });
  });
});
