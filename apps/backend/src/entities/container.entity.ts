import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('containers')
export class Container {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  dockerId: string; // Docker container ID

  @Column()
  name: string;

  @Column()
  image: string; // ubuntu:22.04, node:18 등

  @Column({ default: 'created' })
  status: 'created' | 'running' | 'stopped' | 'exited' | 'error';

  @Column({ type: 'jsonb' })
  ports: Record<string, number>; // { "22": 2221, "80": 8001 }

  @Column({ type: 'jsonb' })
  resources: {
    cpus: number; // 2
    memory: string; // "4g"
    disk?: string; // "20g"
  };

  @Column({ type: 'jsonb', nullable: true })
  environment: Record<string, string>; // 환경 변수

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
