import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Role } from './role.entity';

/**
 * Permission Entity
 * Domain layer entity representing system permissions
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // 'claude:execute', 'docker:create', 'docker:delete', 'system:admin'

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;
}
