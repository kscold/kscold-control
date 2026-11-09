import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 서버 접속용 SSH 키. 개인 키는 암호화해 저장하고 목록 조회에서는 읽지 않는다. */
@Entity('ssh_key_vault')
export class SshKeyVaultEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ type: 'varchar', length: 128 })
  fingerprint: string;

  @Column({ name: 'encrypted_private_key', type: 'text', select: false })
  encryptedPrivateKey: string;

  @Column({
    name: 'private_key_iv',
    type: 'varchar',
    length: 64,
    select: false,
  })
  privateKeyIv: string;

  @Column({
    name: 'private_key_auth_tag',
    type: 'varchar',
    length: 64,
    select: false,
  })
  privateKeyAuthTag: string;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
