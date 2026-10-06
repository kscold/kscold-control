import { Logger } from '@nestjs/common';
import {
  EnvScheduledBackupTargetRepository,
  parseScheduledBackupTargets,
} from '@/system/infrastructure/repositories/env-scheduled-backup-target.repository';

describe('예약 백업 대상 설정', () => {
  const uri = 'mongodb+srv://backup:secret-pass@cluster.example.net/prod';
  const originalValue = process.env.SCHEDULED_MONGODB_BACKUPS;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.SCHEDULED_MONGODB_BACKUPS;
    } else {
      process.env.SCHEDULED_MONGODB_BACKUPS = originalValue;
    }
  });

  describe('parseScheduledBackupTargets', () => {
    it('지정한 값을 그대로 읽는다', () => {
      const raw = JSON.stringify([
        { name: 'app-prod', uri, retentionDays: 30, image: 'mongo:8' },
      ]);

      expect(parseScheduledBackupTargets(raw)).toEqual([
        { name: 'app-prod', uri, retentionDays: 30, image: 'mongo:8' },
      ]);
    });

    it('보관 기간과 이미지를 생략하면 기본값(10일, mongo:7)을 쓴다', () => {
      const raw = JSON.stringify([{ name: 'app-prod', uri }]);

      expect(parseScheduledBackupTargets(raw)).toEqual([
        { name: 'app-prod', uri, retentionDays: 10, image: 'mongo:7' },
      ]);
    });

    it.each([
      ['JSON 이 아닌 값', 'not-json'],
      ['배열이 아닌 값', JSON.stringify({ name: 'app-prod', uri })],
      ['객체가 아닌 항목', JSON.stringify(['app-prod'])],
      ['경로를 벗어나는 이름', JSON.stringify([{ name: '../x', uri }])],
      ['이름 누락', JSON.stringify([{ uri }])],
      [
        '중복된 이름',
        JSON.stringify([
          { name: 'app-prod', uri },
          { name: 'app-prod', uri },
        ]),
      ],
      [
        'MongoDB 가 아닌 URI',
        JSON.stringify([{ name: 'app-prod', uri: 'https://example.net' }]),
      ],
      [
        '공백이 섞인 URI',
        JSON.stringify([{ name: 'app-prod', uri: `${uri} --out /tmp` }]),
      ],
      [
        '따옴표가 섞인 URI',
        JSON.stringify([{ name: 'app-prod', uri: `${uri}"` }]),
      ],
      [
        '0 이하의 보관 기간',
        JSON.stringify([{ name: 'app-prod', uri, retentionDays: 0 }]),
      ],
      [
        '정수가 아닌 보관 기간',
        JSON.stringify([{ name: 'app-prod', uri, retentionDays: '10' }]),
      ],
      [
        '옵션처럼 보이는 이미지',
        JSON.stringify([{ name: 'app-prod', uri, image: '--privileged' }]),
      ],
    ])('%s 은 거부한다', (_label, raw) => {
      expect(() => parseScheduledBackupTargets(raw)).toThrow();
    });

    it('오류 메시지에 접속 URI 를 싣지 않는다', () => {
      const cases = [
        `[{"name":"app-prod","uri":"${uri}"`,
        JSON.stringify([{ name: 'app-prod', uri: `${uri} extra` }]),
        JSON.stringify([{ name: 'app-prod', uri, retentionDays: -1 }]),
      ];

      for (const raw of cases) {
        let message = '';
        try {
          parseScheduledBackupTargets(raw);
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).not.toBe('');
        expect(message).not.toContain('secret-pass');
        expect(message).not.toContain('cluster.example.net');
      }
    });
  });

  describe('EnvScheduledBackupTargetRepository', () => {
    it('환경변수가 비어 있으면 대상이 없다', () => {
      delete process.env.SCHEDULED_MONGODB_BACKUPS;

      expect(new EnvScheduledBackupTargetRepository().findAll()).toEqual([]);
    });

    it('환경변수의 대상을 읽는다', () => {
      process.env.SCHEDULED_MONGODB_BACKUPS = JSON.stringify([
        { name: 'app-prod', uri },
      ]);

      expect(new EnvScheduledBackupTargetRepository().findAll()).toEqual([
        { name: 'app-prod', uri, retentionDays: 10, image: 'mongo:7' },
      ]);
    });

    it('설정이 잘못돼도 예외를 던지지 않고 예약 백업만 끈다', () => {
      process.env.SCHEDULED_MONGODB_BACKUPS = '[{"name":';

      expect(new EnvScheduledBackupTargetRepository().findAll()).toEqual([]);
    });
  });
});
