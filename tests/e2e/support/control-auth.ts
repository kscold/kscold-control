import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';

interface PersistedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface PersistedAuthState {
  state: {
    token: string;
    user: PersistedUser;
  };
  version: number;
}

interface EnvConfig {
  [key: string]: string;
}

function readLocalEnv(): EnvConfig {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');

  return content.split('\n').reduce<EnvConfig>((acc, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return acc;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function withDatabaseName(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function buildConnectionCandidates(env: EnvConfig): string[] {
  const candidates = [
    process.env.CONTROL_E2E_DATABASE_URL,
    env.DATABASE_URL,
    env.DATABASE_URL ? withDatabaseName(env.DATABASE_URL, 'kscold-infra-db') : undefined,
    env.DATABASE_URL ? withDatabaseName(env.DATABASE_URL, 'control-db') : undefined,
    env.INFRA_DB_USER && env.INFRA_DB_PASSWORD
      ? `postgresql://${env.INFRA_DB_USER}:${env.INFRA_DB_PASSWORD}@localhost:5432/kscold-infra-db`
      : undefined,
    env.INFRA_DB_USER && env.INFRA_DB_PASSWORD
      ? `postgresql://${env.INFRA_DB_USER}:${env.INFRA_DB_PASSWORD}@localhost:5432/control-db`
      : undefined,
  ];

  return [...new Set(candidates.filter(Boolean) as string[])];
}

async function findAdminUser(connectionString: string): Promise<PersistedUser | null> {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query<{
      id: string;
      email: string;
      roles: string[];
      permissions: string[];
      is_admin: boolean;
    }>(`
      SELECT
        u.id,
        u.email,
        array_remove(array_agg(DISTINCT r.name), NULL) AS roles,
        array_remove(array_agg(DISTINCT p.name), NULL) AS permissions,
        bool_or(r.name IN ('admin', 'super_admin')) AS is_admin
      FROM users u
      LEFT JOIN user_roles ur ON ur."userId" = u.id
      LEFT JOIN roles r ON r.id = ur."roleId"
      LEFT JOIN role_permissions rp ON rp."roleId" = r.id
      LEFT JOIN permissions p ON p.id = rp."permissionId"
      GROUP BY u.id, u.email
      ORDER BY is_admin DESC, u.email ASC
      LIMIT 5
    `);

    const row = result.rows.find((item) => item.is_admin) ?? result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
    };
  } finally {
    await client.end();
  }
}

async function validateToken(apiBaseUrl: string, token: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok;
}

export async function createPersistedAdminAuthState(apiBaseUrl: string): Promise<string> {
  const env = readLocalEnv();
  const jwtSecret = process.env.JWT_SECRET ?? env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET을 찾지 못했습니다.');
  }

  for (const connectionString of buildConnectionCandidates(env)) {
    try {
      const user = await findAdminUser(connectionString);
      if (!user) {
        continue;
      }

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
        },
        jwtSecret,
        {
          expiresIn: '15m',
        },
      );

      const isValid = await validateToken(apiBaseUrl, token);
      if (!isValid) {
        continue;
      }

      const persistedState: PersistedAuthState = {
        state: {
          token,
          user,
        },
        version: 0,
      };

      return JSON.stringify(persistedState);
    } catch {
      continue;
    }
  }

  throw new Error('테스트에 사용할 관리자 인증 정보를 만들지 못했습니다.');
}
