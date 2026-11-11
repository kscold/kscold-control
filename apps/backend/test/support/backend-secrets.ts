export const BACKEND_SECRETS = {
  JWT_SECRET: 'test-jwt-secret-value',
  DATABASE_URL: 'postgresql://control:pw@db.example.com:5432/control',
  KEY_MANAGEMENT_ENCRYPTION_KEY: 'test-kms-encryption-key',
  CONTROL_PROXY_SECRET: 'test-proxy-secret',
  INFRA_DB_PASSWORD: 'test-db-password',
  ADMIN_PASSWORD: 'test-admin-password',
  BLOG_JWT_REFRESH_SECRET: 'test-blog-refresh-secret',
  GH_TOKEN: 'test-gh-token',
  BLOG_MONGODB_URI: 'mongodb://blog:pw@db.example.com:27017/blog',
  NODE_ENV: 'production',
  OPENAI_API_KEY: 'test-openai-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
};

const SECRET_NAME = /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL|_URI$/;

export function secretNames(env: Record<string, string | undefined>) {
  return Object.keys(env)
    .filter((key) => SECRET_NAME.test(key))
    .sort();
}

export function withBackendEnv(extra: Record<string, string> = {}) {
  const saved = process.env;
  beforeEach(() => {
    process.env = {
      ...saved,
      ...BACKEND_SECRETS,
      DOCKER_HOST: 'unix:///tmp/docker-test.sock',
      LC_ALL: 'C',
      ...extra,
    };
  });
  afterEach(() => {
    process.env = saved;
  });
}
