import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Session } from '../../../terminal/domain/entities/session.entity';
import { Container } from '../../../docker/domain/entities/container.entity';
import { Role } from './role.entity';

/**
 * User Entity
 * Domain layer entity representing system users
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // bcrypt hashed

  @ManyToMany(() => Role, (role) => role.users, { cascade: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Container, (container) => container.user)
  containers: Container[];

  @Column({ default: 0 })
  terminalCommandCount: number; // 사용한 터미널 명령어 횟수

  @Column({ default: -1 })
  terminalCommandLimit: number; // 명령어 제한 (-1 = 무제한)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
