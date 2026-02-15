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
        PORT: 4000,
        // SECURITY: Never commit real credentials! Set these via:
        // 1. PM2 ecosystem file with env_file option, or
        // 2. PM2 startup command: pm2 start ecosystem.config.js --update-env
        // 3. System environment variables
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/claude_infra',
        JWT_SECRET: process.env.JWT_SECRET || 'kscold-infra-secret-change-in-production',
        CLAUDE_WORKING_DIR: process.env.CLAUDE_WORKING_DIR || '/Users/kscold/Desktop',
      },
      // 자동 재시작
      watch: false,
      max_memory_restart: '500M',

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
