import { shouldSynchronizeDatabase } from '@/common/utils/database-synchronize.util';

describe('shouldSynchronizeDatabase', () => {
  it('명시 플래그가 없으면 개발 모드에서도 비활성화한다', () => {
    expect(
      shouldSynchronizeDatabase({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://admin:test@localhost/control-dev',
      }),
    ).toBe(false);
  });

  it('localhost의 dev/test DB에 명시한 경우만 활성화한다', () => {
    expect(
      shouldSynchronizeDatabase({
        NODE_ENV: 'development',
        TYPEORM_SYNCHRONIZE: 'true',
        DATABASE_URL: 'postgresql://admin:test@127.0.0.1/control-test',
      }),
    ).toBe(true);
  });

  it.each([
    {
      label: 'production 모드',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://admin:test@localhost/control-test',
    },
    {
      label: '운영 DB 이름',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://admin:test@localhost/kscold-infra-db',
    },
    {
      label: '원격 호스트',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://admin:test@db.internal/control-test',
    },
  ])('$label 에서는 명시 플래그가 있어도 거부한다', (environment) => {
    expect(() =>
      shouldSynchronizeDatabase({
        ...environment,
        TYPEORM_SYNCHRONIZE: 'true',
      }),
    ).toThrow(/synchronize/);
  });
});
