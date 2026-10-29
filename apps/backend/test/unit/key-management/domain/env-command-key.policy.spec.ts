import {
  ANY_ENV_KEY,
  acceptsAnyEnvKey,
  isAllowedEnvCommandKey,
  isReservedEnvKey,
} from '../../../../src/key-management/domain/policies/env-command-key.policy';

describe('env-command-key.policy', () => {
  it('allowedKeys 가 * 하나일 때만 전체 키 모드로 본다', () => {
    expect(acceptsAnyEnvKey([ANY_ENV_KEY])).toBe(true);
    expect(acceptsAnyEnvKey([ANY_ENV_KEY, 'MINIO_BUCKET'])).toBe(false);
    expect(acceptsAnyEnvKey(['MINIO_BUCKET'])).toBe(false);
  });

  it.each([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GADOC_CHAT_DEPLOY_TEAM_IDS',
    'S3_REGION',
  ])('전체 키 모드에서 새 기능 키 %s 를 받는다', (key) => {
    expect(isAllowedEnvCommandKey([ANY_ENV_KEY], key)).toBe(true);
  });

  it.each([
    'NODE_OPTIONS',
    'NODE_TLS_REJECT_UNAUTHORIZED',
    'LD_PRELOAD',
    'PATH',
    'PORT',
    'HOST',
    'NEXT_PUBLIC_API_URL',
    'PM2_HOME',
    'MONGO_INITDB_ROOT_PASSWORD',
    'GADOC_PUBLIC_ORIGIN',
    'lowercase_key',
  ])('전체 키 모드에서도 예약 키 %s 는 거절한다', (key) => {
    expect(isAllowedEnvCommandKey([ANY_ENV_KEY], key)).toBe(false);
  });

  it('명시 목록 모드는 목록에 있는 키만 받는다', () => {
    expect(isAllowedEnvCommandKey(['MINIO_BUCKET'], 'MINIO_BUCKET')).toBe(true);
    expect(isAllowedEnvCommandKey(['MINIO_BUCKET'], 'OPENAI_API_KEY')).toBe(
      false,
    );
  });

  it('MONGODB_URI 는 MONGO_ 예약 접두어에 걸리지 않는다', () => {
    expect(isReservedEnvKey('MONGODB_URI')).toBe(false);
    expect(isReservedEnvKey('MONGO_INITDB_ROOT_USERNAME')).toBe(true);
  });
});
