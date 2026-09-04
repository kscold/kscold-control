const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEVELOPMENT_DATABASE_NAME = /(^|[-_])(dev|development|test)([-_]|$)/i;

interface DatabaseRuntimeEnvironment {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  TYPEORM_SYNCHRONIZE?: string;
}

export function shouldSynchronizeDatabase(
  environment: DatabaseRuntimeEnvironment = process.env as DatabaseRuntimeEnvironment,
): boolean {
  if (environment.TYPEORM_SYNCHRONIZE !== 'true') {
    return false;
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error(
      'production에서는 TypeORM synchronize를 사용할 수 없습니다.',
    );
  }
  if (!environment.DATABASE_URL) {
    throw new Error('TypeORM synchronize에는 DATABASE_URL이 필요합니다.');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(environment.DATABASE_URL);
  } catch {
    throw new Error(
      'TypeORM synchronize 대상 DATABASE_URL이 올바르지 않습니다.',
    );
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (
    !LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname) ||
    !DEVELOPMENT_DATABASE_NAME.test(databaseName)
  ) {
    throw new Error(
      'TypeORM synchronize는 localhost의 dev/test 데이터베이스에서만 사용할 수 있습니다.',
    );
  }

  return true;
}
