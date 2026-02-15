import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../rbac/domain/entities/user.entity';

/**
 * Container Domain Entity
 * Represents a Docker container in the system
 */
@Entity('containers')
export class Container {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  dockerId: string; // Docker container ID from Dockerode

  @Column()
  name: string;

  @Column()
  image: string; // e.g., ubuntu:22.04, node:18

  @Column({ default: 'created' })
  status: 'created' | 'running' | 'stopped' | 'exited' | 'error';

  @Column({ type: 'jsonb' })
  ports: Record<string, number>; // { "22": 2221, "80": 8001 }

  @Column({ type: 'jsonb' })
  resources: {
    cpus: number; // Number of CPU cores
    memory: string; // Memory limit (e.g., "4g")
    disk?: string; // Disk limit (optional, e.g., "20g")
  };

  @Column({ type: 'jsonb', nullable: true })
  environment: Record<string, string>; // Environment variables

  @ManyToOne(() => User, (user) => user.containers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  stoppedAt: Date;
}
