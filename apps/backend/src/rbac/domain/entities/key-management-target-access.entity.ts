import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('user_key_management_targets')
@Index('idx_user_key_management_targets_target_id', ['targetId', 'userId'])
export class KeyManagementTargetAccess {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'target_id', type: 'varchar', length: 80 })
  targetId: string;

  @Column({ name: 'granted_by_id', type: 'uuid', nullable: true })
  grantedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
