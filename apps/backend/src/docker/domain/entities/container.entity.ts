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
 * 관리 대상 Docker 컨테이너의 도메인 엔티티임.
 * Docker 엔진의 실시간 상태와 별개로 소유자, 생성 요청, 관리 이력 저장함.
 */
@Entity('containers')
export class Container {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  dockerId: string; // Docker 엔진이 부여한 컨테이너 식별자

  @Column()
  name: string;

  @Column()
  image: string; // 예: ubuntu:22.04, node:18

  @Column({ default: 'created' })
  status: 'created' | 'running' | 'stopped' | 'exited' | 'error';

  @Column({ type: 'jsonb' })
  ports: Record<string, number>; // { "22": 2221, "80": 8001 }

  @Column({ type: 'jsonb' })
  resources: {
    cpus: number; // CPU 코어 수
    memory: string; // 메모리 제한, 예: "4g"
    disk?: string; // 디스크 제한, 선택값, 예: "20g"
  };

  @Column({ type: 'jsonb', nullable: true })
  environment: Record<string, string>; // 컨테이너 환경 변수

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
