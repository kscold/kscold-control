import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBackupTargetDto,
  ListBackupRunsDto,
  UpdateBackupTargetDto,
} from '@/backup/application/dto';

type DtoClass<T> = new () => T;

async function errorFields<T extends object>(
  dto: DtoClass<T>,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('백업 요청 DTO', () => {
  const validCreate = {
    name: 'app-prod',
    uri: 'mongodb+srv://backup:pass@cluster.example.net/prod',
  };

  describe('CreateBackupTargetDto', () => {
    it('이름과 접속 URI 만으로 등록할 수 있다', async () => {
      await expect(
        errorFields(CreateBackupTargetDto, validCreate),
      ).resolves.toEqual([]);
    });

    it('모든 항목을 채운 요청을 허용한다', async () => {
      await expect(
        errorFields(CreateBackupTargetDto, {
          ...validCreate,
          description: '운영 DB',
          retentionDays: 14,
          scheduleTime: '04:00',
          dumpImage: 'mongo:7',
          enabled: false,
        }),
      ).resolves.toEqual([]);
    });

    it.each([
      ['name', '../escape'],
      ['name', undefined],
      ['uri', 'postgres://db.example.net/app'],
      ['uri', 'mongodb://user:pa ss@db.example.net/app'],
      ['uri', undefined],
      ['retentionDays', 0],
      ['retentionDays', 3651],
      ['retentionDays', 1.5],
      ['scheduleTime', '24:00'],
      ['scheduleTime', '3:30'],
      ['dumpImage', '--privileged'],
      ['enabled', 'yes'],
      ['description', 'a'.repeat(501)],
    ])('%s 값 %p 은 거부한다', async (field, value) => {
      await expect(
        errorFields(CreateBackupTargetDto, { ...validCreate, [field]: value }),
      ).resolves.toEqual([field]);
    });

    it('정의하지 않은 항목은 거부한다', async () => {
      await expect(
        errorFields(CreateBackupTargetDto, {
          ...validCreate,
          encryptedUri: 'injected',
        }),
      ).resolves.toEqual(['encryptedUri']);
    });
  });

  describe('UpdateBackupTargetDto', () => {
    it('아무 항목도 보내지 않아도 형식상 유효하다', async () => {
      await expect(errorFields(UpdateBackupTargetDto, {})).resolves.toEqual([]);
    });

    it('일부 항목만 보낼 수 있다', async () => {
      await expect(
        errorFields(UpdateBackupTargetDto, {
          retentionDays: 30,
          enabled: false,
        }),
      ).resolves.toEqual([]);
    });

    it('이름은 바꿀 수 없으므로 받지 않는다', async () => {
      await expect(
        errorFields(UpdateBackupTargetDto, { name: 'renamed' }),
      ).resolves.toEqual(['name']);
    });

    it.each([
      ['uri', 'not-a-uri'],
      ['retentionDays', -1],
      ['scheduleTime', 'noon'],
      ['dumpImage', 'mongo;rm'],
    ])('%s 값 %p 은 거부한다', async (field, value) => {
      await expect(
        errorFields(UpdateBackupTargetDto, { [field]: value }),
      ).resolves.toEqual([field]);
    });
  });

  describe('ListBackupRunsDto', () => {
    it('쿼리 문자열로 온 건수를 숫자로 바꿔 받는다', async () => {
      const dto = plainToInstance(ListBackupRunsDto, { limit: '20' });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.limit).toBe(20);
    });

    it.each([
      ['limit', '0'],
      ['limit', '101'],
      ['limit', 'many'],
      ['targetId', 'not-a-uuid'],
    ])('%s 값 %p 은 거부한다', async (field, value) => {
      await expect(
        errorFields(ListBackupRunsDto, { [field]: value }),
      ).resolves.toEqual([field]);
    });

    it('대상 id 는 UUID 여야 한다', async () => {
      await expect(
        errorFields(ListBackupRunsDto, {
          targetId: '0f8fad5b-d9cb-469f-a165-70867728950e',
        }),
      ).resolves.toEqual([]);
    });
  });
});
