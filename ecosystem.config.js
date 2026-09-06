const path = require('node:path');

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

function definedEnvironment(keys) {
  return Object.fromEntries(
    keys
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before starting kscold-control');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a random value of at least 32 characters',
  );
}

module.exports = {
  apps: [
    {
      name: 'kscold-control',
      cwd: './apps/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        TYPEORM_SYNCHRONIZE: 'false',
        PORT: 4000,
        // SECURITY: Never commit real credentials! Set these via:
        // 1. PM2 ecosystem file with env_file option, or
        // 2. PM2 startup command: pm2 start ecosystem.config.js --update-env
        // 3. System environment variables
        DATABASE_URL: databaseUrl,
        DOCKER_HOST:
          process.env.DOCKER_HOST ||
          'unix:///Users/kscold/.colima/default/docker.sock',
        JWT_SECRET: jwtSecret,
        FRONTEND_URL: process.env.FRONTEND_URL || 'https://control.kscold.com',
        CONTROL_FRONTEND_DIST_PATH:
          process.env.CONTROL_FRONTEND_DIST_PATH ||
          path.join(__dirname, '.runtime', 'frontend-current'),
        CLAUDE_WORKING_DIR:
          process.env.CLAUDE_WORKING_DIR || '/Users/kscold/Desktop',
        REPOSITORY_STORAGE_DIR:
          process.env.REPOSITORY_STORAGE_DIR ||
          '/Users/kscold/repository-storage',
        KEY_MANAGEMENT_ENCRYPTION_KEY:
          process.env.KEY_MANAGEMENT_ENCRYPTION_KEY,
        KEY_MANAGEMENT_GCLOUD_PATH: process.env.KEY_MANAGEMENT_GCLOUD_PATH,
        KEY_MANAGEMENT_GH_PATH: process.env.KEY_MANAGEMENT_GH_PATH,
        KEY_MANAGEMENT_SSH_PATH: process.env.KEY_MANAGEMENT_SSH_PATH,
        KEY_MANAGEMENT_SSH_IDENTITY_DIR:
          process.env.KEY_MANAGEMENT_SSH_IDENTITY_DIR,
        ...definedEnvironment([
          'ADMIN_EMAIL',
          'ADMIN_PASSWORD',
          'SEED_ADMIN_BOOTSTRAP',
          'CLAUDE_CODE_BIN',
          'CLAUDE_BINARY_PATH',
          'CODEX_BIN',
          'OPENAI_API_KEY',
          'OPENAI_MODEL',
          'REPOSITORY_UPLOAD_SESSION_DIR',
          'SECURITY_ALLOWLIST',
        ]),
      },
      // 자동 재시작
      watch: false,
      // 소스 업로드 시 배치 multipart 파싱으로 메모리가 일시적으로 크게 튄다.
      // 500M는 빠듯해 큰 프로젝트(bigzmai 등) 업로드 중 PM2가 프로세스를 죽여
      // "Network Error"가 발생했다. 넉넉히 2G로 상향.
      max_memory_restart: '2G',
      // Node 힙도 함께 키워 GC 압박/OOM을 방지.
      node_args: '--max-old-space-size=2048',

      // 로그
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,

      // 크래시 시 재시작
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
