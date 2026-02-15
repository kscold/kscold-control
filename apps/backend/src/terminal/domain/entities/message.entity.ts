import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';

/**
 * Message Entity
 * Domain layer entity representing terminal messages
 */
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @Column()
  sessionId: string;

  @Column()
  role: 'user' | 'assistant' | 'system';

  @Column('text')
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // File paths, tool usage, etc.

  @CreateDateColumn()
  timestamp: Date;
}
