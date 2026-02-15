import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Session } from './entities/session.entity';
import { Message } from './entities/message.entity';
import { Container } from './entities/container.entity';

/**
 * 초기 데이터 시드
 * 실행: npx ts-node src/seed.ts
 */
async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Role, Permission, Session, Message, Container],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('DB connected');

  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);

  // 1. Permission 생성
  const permissionNames = [
    { name: 'claude:execute', description: 'Claude Code 실행' },
    { name: 'docker:create', description: '컨테이너 생성' },
    { name: 'docker:start', description: '컨테이너 시작' },
    { name: 'docker:stop', description: '컨테이너 중지' },
    { name: 'docker:delete', description: '컨테이너 삭제' },
    { name: 'docker:read-all', description: '모든 컨테이너 조회' },
    { name: 'session:read', description: '세션 조회' },
    { name: 'session:write', description: '세션 생성/수정' },
    { name: 'user:manage', description: '사용자 관리' },
  ];

  const permissions: Permission[] = [];
  for (const p of permissionNames) {
    let permission = await permissionRepo.findOne({
      where: { name: p.name },
    });
    if (!permission) {
      permission = permissionRepo.create(p);
      await permissionRepo.save(permission);
    }
    permissions.push(permission);
  }
  console.log(`${permissions.length} permissions created`);

  // 2. Role 생성
  const adminRole =
    (await roleRepo.findOne({
      where: { name: 'admin' },
      relations: ['permissions'],
    })) ||
    roleRepo.create({
      name: 'admin',
      description: '관리자 - 모든 권한',
      permissions: permissions, // 모든 권한
    });
  await roleRepo.save(adminRole);

  const developerRole =
    (await roleRepo.findOne({
      where: { name: 'developer' },
      relations: ['permissions'],
    })) ||
    roleRepo.create({
      name: 'developer',
      description: '개발자 - Claude + Docker 권한',
      permissions: permissions.filter(
        (p) => p.name !== 'user:manage' && p.name !== 'docker:read-all',
      ),
    });
  await roleRepo.save(developerRole);

  const viewerRole =
    (await roleRepo.findOne({
      where: { name: 'viewer' },
      relations: ['permissions'],
    })) ||
    roleRepo.create({
      name: 'viewer',
      description: '뷰어 - 읽기 전용',
      permissions: permissions.filter((p) => p.name === 'session:read'),
    });
  await roleRepo.save(viewerRole);

  console.log('3 roles created (admin, developer, viewer)');

  // 3. Admin 계정 생성
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kscold.dev';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD not set, skipping admin user creation');
  } else {
    const existingAdmin = await userRepo.findOne({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const adminUser = userRepo.create({
        email: adminEmail,
        password: hashedPassword,
        roles: [adminRole],
      });
      await userRepo.save(adminUser);
      console.log(`Admin user created: ${adminEmail}`);
    } else {
      console.log('Admin user already exists');
    }
  }

  await dataSource.destroy();
  console.log('Seed completed!');
}

seed().catch(console.error);
