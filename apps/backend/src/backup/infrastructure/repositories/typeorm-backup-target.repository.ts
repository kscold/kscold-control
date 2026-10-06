import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupTarget } from '../../domain/entities/backup-target.entity';
import type {
  CreateBackupTargetInput,
  IBackupTargetRepository,
  UpdateBackupTargetInput,
} from '../../domain/repositories/backup-target.repository';

@Injectable()
export class TypeOrmBackupTargetRepository implements IBackupTargetRepository {
  constructor(
    @InjectRepository(BackupTarget)
    private readonly repository: Repository<BackupTarget>,
  ) {}

  findAll(): Promise<BackupTarget[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findEnabled(): Promise<BackupTarget[]> {
    return this.repository.find({
      where: { enabled: true },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<BackupTarget | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<BackupTarget | null> {
    return this.repository.findOne({ where: { name } });
  }

  findByIdWithSecret(id: string): Promise<BackupTarget | null> {
    return this.repository
      .createQueryBuilder('target')
      .addSelect('target.encryptedUri')
      .addSelect('target.uriIv')
      .addSelect('target.uriAuthTag')
      .where('target.id = :id', { id })
      .getOne();
  }

  async create(input: CreateBackupTargetInput): Promise<BackupTarget> {
    const saved = await this.repository.save(this.repository.create(input));
    // save 가 돌려주는 객체에는 방금 넣은 암호문이 그대로 들어 있어, 다시 읽어 돌려준다.
    return (await this.findById(saved.id)) as BackupTarget;
  }

  async update(
    id: string,
    input: UpdateBackupTargetInput,
  ): Promise<BackupTarget | null> {
    // 엔티티를 통째로 저장하지 않고 바뀐 컬럼만 고친다.
    // 암호문 컬럼은 일반 조회에서 읽지 않으므로, 통째로 저장하면 의도와 다르게 덮어쓸 수 있다.
    if (Object.keys(input).length > 0) {
      await this.repository.update({ id }, input);
    }
    return this.findById(id);
  }

  async moveScheduleCursor(id: string, at: Date): Promise<void> {
    // 쿼리 빌더는 수정 시각까지 함께 갱신한다. 예약 실행은 설정 변경이 아니므로 직접 쓴다.
    await this.repository.query(
      'UPDATE backup_targets SET schedule_cursor_at = $1 WHERE id = $2',
      [at, id],
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
