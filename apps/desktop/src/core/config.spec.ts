import { describe, expect, it } from 'vitest';
import { buildBackendEnv, createConfig, validateAnswers, type InstallAnswers } from './config';

const answers: InstallAnswers = {
  adminEmail: ' admin@example.com ',
  adminPassword: 'correct-horse-battery',
  port: 4000,
  dataDir: '/Users/me/kscold-control',
  startAtLogin: true,
  anthropicApiKey: '  ',
};

const fixedRandom = (size: number) => Buffer.alloc(size, 7);

describe('설치 설정', () => {
  it('입력이 맞으면 문제 없이 통과한다', () => {
    expect(validateAnswers(answers)).toEqual([]);
  });

  it('짧은 비밀번호·잘못된 포트·상대 경로를 모두 알려 준다', () => {
    expect(
      validateAnswers({ ...answers, adminPassword: 'short', port: 80, dataDir: 'relative' }),
    ).toHaveLength(3);
  });

  it('비밀 키는 새로 만들고 빈 API 키는 넣지 않는다', () => {
    const config = createConfig(answers, 55432, fixedRandom);
    expect(config.adminEmail).toBe('admin@example.com');
    expect(config.secrets.databasePassword).toMatch(/^[0-9a-f]{48}$/);
    expect(Buffer.from(config.secrets.mfaEncryptionKey, 'base64')).toHaveLength(32);
    expect(config.apiKeys.anthropic).toBeUndefined();
  });

  it('첫 기동에만 관리자 계정을 만들도록 환경 변수를 준다', () => {
    const config = createConfig(answers, 55432, fixedRandom);
    const firstEnv = buildBackendEnv(config, { controlRoot: '/app/control' });
    expect(firstEnv).toMatchObject({
      SEED_ADMIN_BOOTSTRAP: 'true',
      ADMIN_PASSWORD: 'correct-horse-battery',
      CONTROL_BIND_HOST: '127.0.0.1',
      PORT: '4000',
    });
    expect(firstEnv.DATABASE_URL).toBe(
      `postgresql://control:${config.secrets.databasePassword}@127.0.0.1:55432/kscold_control`,
    );

    delete config.pendingAdminPassword;
    const laterEnv = buildBackendEnv(config, { controlRoot: '/app/control' });
    expect(laterEnv.SEED_ADMIN_BOOTSTRAP).toBe('false');
    expect(laterEnv.ADMIN_PASSWORD).toBeUndefined();
  });
});
