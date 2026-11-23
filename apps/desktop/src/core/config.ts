import { randomBytes } from 'node:crypto';
import path from 'node:path';

/** 설치 마법사에서 사용자가 정하는 값 */
export interface InstallAnswers {
  adminEmail: string;
  adminPassword: string;
  port: number;
  dataDir: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  startAtLogin: boolean;
}

/** 디스크에 저장하는 설정. 관리자 비밀번호는 첫 기동 뒤 지운다. */
export interface DesktopConfig {
  version: 1;
  adminEmail: string;
  /** 첫 기동에서 관리자 계정을 만든 뒤 지운다 */
  pendingAdminPassword?: string;
  port: number;
  dataDir: string;
  databasePort: number;
  startAtLogin: boolean;
  secrets: {
    databasePassword: string;
    jwtSecret: string;
    mfaEncryptionKey: string;
    keyManagementEncryptionKey: string;
  };
  apiKeys: {
    anthropic?: string;
    openai?: string;
  };
}

export const DATABASE_CONTAINER = 'kscold-control-db';
export const DATABASE_VOLUME = 'kscold-control-db-data';
export const DATABASE_NAME = 'kscold_control';
export const DATABASE_USER = 'control';

type RandomSource = (size: number) => Buffer;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 마법사 입력을 확인하고 문제 문장 목록을 돌려준다. 비어 있으면 통과. */
export function validateAnswers(answers: InstallAnswers): string[] {
  const problems: string[] = [];
  if (!EMAIL_PATTERN.test(answers.adminEmail.trim())) {
    problems.push('관리자 이메일 형식을 확인해 주세요.');
  }
  if (answers.adminPassword.length < 12) {
    problems.push('관리자 비밀번호는 12자 이상이어야 합니다.');
  }
  if (!Number.isInteger(answers.port) || answers.port < 1024 || answers.port > 65535) {
    problems.push('포트는 1024~65535 사이 숫자여야 합니다.');
  }
  if (!answers.dataDir.trim() || !path.isAbsolute(answers.dataDir.trim())) {
    problems.push('데이터 폴더는 전체 경로로 골라 주세요.');
  }
  return problems;
}

/** 마법사 입력으로 설정을 만든다. 비밀 키는 모두 새로 만든다. */
export function createConfig(
  answers: InstallAnswers,
  databasePort: number,
  random: RandomSource = randomBytes,
): DesktopConfig {
  return {
    version: 1,
    adminEmail: answers.adminEmail.trim(),
    pendingAdminPassword: answers.adminPassword,
    port: answers.port,
    dataDir: answers.dataDir.trim(),
    databasePort,
    startAtLogin: answers.startAtLogin,
    secrets: {
      // 데이터베이스 주소에 그대로 들어가므로 URL 에 안전한 글자만 쓴다.
      databasePassword: random(24).toString('hex'),
      jwtSecret: random(48).toString('base64url'),
      mfaEncryptionKey: random(32).toString('base64'),
      keyManagementEncryptionKey: random(32).toString('base64'),
    },
    apiKeys: {
      anthropic: answers.anthropicApiKey?.trim() || undefined,
      openai: answers.openaiApiKey?.trim() || undefined,
    },
  };
}

export interface ControlPaths {
  /** 백엔드 dist·마이그레이션·프론트 빌드가 들어 있는 폴더 */
  controlRoot: string;
}

/** 백엔드 프로세스에 넘길 환경 변수 */
export function buildBackendEnv(
  config: DesktopConfig,
  paths: ControlPaths,
): Record<string, string> {
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    TYPEORM_SYNCHRONIZE: 'false',
    PORT: String(config.port),
    CONTROL_BIND_HOST: '127.0.0.1',
    FRONTEND_URL: `http://localhost:${config.port}`,
    DATABASE_URL: `postgresql://${DATABASE_USER}:${config.secrets.databasePassword}@127.0.0.1:${config.databasePort}/${DATABASE_NAME}`,
    JWT_SECRET: config.secrets.jwtSecret,
    CONTROL_MFA_ENCRYPTION_KEY: config.secrets.mfaEncryptionKey,
    KEY_MANAGEMENT_ENCRYPTION_KEY: config.secrets.keyManagementEncryptionKey,
    CONTROL_FRONTEND_DIST_PATH: path.join(paths.controlRoot, 'runtime', 'frontend-current'),
    REPOSITORY_STORAGE_DIR: path.join(config.dataDir, 'repository-storage'),
    REPOSITORY_UPLOAD_SESSION_DIR: path.join(config.dataDir, 'upload-sessions'),
    CLAUDE_WORKING_DIR: config.dataDir,
    ADMIN_EMAIL: config.adminEmail,
    SEED_ADMIN_BOOTSTRAP: config.pendingAdminPassword ? 'true' : 'false',
    // 설치본은 이 컴퓨터의 다른 nginx 를 건드리지 않는다.
    NGINX_CONTAINER: '',
    CONTROL_DATA_DIR: path.join(config.dataDir, 'control-data'),
    // SSH 차단 기록도 설치본 데이터 폴더 안에만 둔다(이 컴퓨터의 다른 방화벽 파일을 건드리지 않음).
    SSH_AUDIT_DIR: path.join(config.dataDir, 'control-data', 'ssh-audit'),
  };
  if (config.pendingAdminPassword) env.ADMIN_PASSWORD = config.pendingAdminPassword;
  if (config.apiKeys.anthropic) env.ANTHROPIC_API_KEY = config.apiKeys.anthropic;
  if (config.apiKeys.openai) env.OPENAI_API_KEY = config.apiKeys.openai;
  return env;
}
