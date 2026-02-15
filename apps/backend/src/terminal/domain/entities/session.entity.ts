import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../rbac/domain/entities/user.entity';
import { Message } from './message.entity';

/**
 * Session Entity
 * Domain layer entity representing terminal sessions
 */
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string; // Session title (e.g., "Docker setup help")

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Message, (message) => message.session, { cascade: true })
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date;
}
