import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getHomeDirectory } from '../../../common/utils';
import type { WorktreeCleanupTarget } from '../../domain/entities/worktree-cleanup-target.entity';
import {
  DEFAULT_BASE_REFS,
  isAllowedCleanupRoot,
  isValidBaseRef,
  isValidCleanupTargetName,
} from '../../domain/policies/worktree-cleanup-target.policy';
import { DEFAULT_KEEP_RECENT } from '../../domain/policies/worktree-retention.policy';
import {
  WORKTREE_CLEANUP_TARGET_REPOSITORY,
  type IWorktreeCleanupTargetRepository,
  type UpdateWorktreeCleanupTargetInput,
} from '../../domain/repositories/worktree-cleanup-target.repository';
import {
  WORKTREE_WORKSPACE_GATEWAY,
  type IWorktreeWorkspaceGateway,
} from '../../domain/repositories/worktree-workspace.gateway';
import { WorktreeCleanupRunnerService } from '../services/worktree-cleanup-runner.service';

/** 정리 시각을 지정하지 않은 대상의 기본값. 백업(03:30·03:40)과 SSL 갱신(04:10) 뒤로 잡았다. */
export const DEFAULT_WORKTREE_CLEANUP_TIME = '04:30';

export interface CreateWorktreeCleanupTargetParams {
  name: string;
  description?: string;
  rootPath: string;
  keepRecent?: number;
  protectUnmerged?: boolean;
  baseRefs?: string[];
  scheduleTime?: string;
  enabled?: boolean;
  createdBy: string | null;
}

export type UpdateWorktreeCleanupTargetParams = Omit<
  Partial<CreateWorktreeCleanupTargetParams>,
  'name' | 'rootPath' | 'createdBy'
>;

/** 정리 대상 등록·수정·삭제 */
@Injectable()
export class ManageWorktreeCleanupTargetUseCase {
  constructor(
    @Inject(WORKTREE_CLEANUP_TARGET_REPOSITORY)
    private readonly targetRepository: IWorktreeCleanupTargetRepository,
    @Inject(WORKTREE_WORKSPACE_GATEWAY)
    private readonly workspace: IWorktreeWorkspaceGateway,
    private readonly runner: WorktreeCleanupRunnerService,
  ) {}

  async create(
    params: CreateWorktreeCleanupTargetParams,
  ): Promise<WorktreeCleanupTarget> {
    const name = params.name.trim();
    const rootPath = params.rootPath.trim().replace(/\/+$/, '');
    if (!isValidCleanupTargetName(name)) {
      throw new BadRequestException('정리 대상 이름 형식이 올바르지 않습니다.');
    }
    if (!isAllowedCleanupRoot(rootPath, getHomeDirectory())) {
      throw new BadRequestException(
        '정리 루트는 홈 디렉터리 아래의 절대 경로여야 합니다 (홈 디렉터리 자체는 안 됩니다).',
      );
    }
    if (!(await this.workspace.rootExists(rootPath))) {
      throw new BadRequestException(`정리 루트가 없습니다: ${rootPath}`);
    }
    const baseRefs = this.normalizeBaseRefs(
      params.baseRefs ?? DEFAULT_BASE_REFS,
    );
    if (await this.targetRepository.findByNameOrRoot(name, rootPath)) {
      throw new ConflictException(
        '같은 이름이나 같은 정리 루트의 대상이 이미 있습니다.',
      );
    }

    return this.targetRepository.create({
      name,
      description: params.description?.trim() ?? '',
      rootPath,
      keepRecent: params.keepRecent ?? DEFAULT_KEEP_RECENT,
      protectUnmerged: params.protectUnmerged ?? true,
      baseRefs,
      scheduleTime: params.scheduleTime ?? DEFAULT_WORKTREE_CLEANUP_TIME,
      enabled: params.enabled ?? true,
      // 등록한 뒤 처음 돌아오는 예약 시각부터 실행한다.
      scheduleCursorAt: new Date(),
      createdBy: params.createdBy,
    });
  }

  async update(
    id: string,
    params: UpdateWorktreeCleanupTargetParams,
  ): Promise<{ target: WorktreeCleanupTarget; changedFields: string[] }> {
    const current = await this.targetRepository.findById(id);
    if (!current) {
      throw new NotFoundException('등록되지 않은 정리 대상입니다.');
    }

    const changes: UpdateWorktreeCleanupTargetInput = {};
    const changedFields: string[] = [];
    const set = <Key extends keyof UpdateWorktreeCleanupTargetInput>(
      key: Key,
      value: UpdateWorktreeCleanupTargetInput[Key],
    ) => {
      changes[key] = value;
      changedFields.push(key);
    };

    if (
      params.description !== undefined &&
      params.description.trim() !== current.description
    ) {
      set('description', params.description.trim());
    }
    if (
      params.keepRecent !== undefined &&
      params.keepRecent !== current.keepRecent
    ) {
      set('keepRecent', params.keepRecent);
    }
    if (
      params.protectUnmerged !== undefined &&
      params.protectUnmerged !== current.protectUnmerged
    ) {
      set('protectUnmerged', params.protectUnmerged);
    }
    if (params.baseRefs !== undefined) {
      const baseRefs = this.normalizeBaseRefs(params.baseRefs);
      if (JSON.stringify(baseRefs) !== JSON.stringify(current.baseRefs)) {
        set('baseRefs', baseRefs);
      }
    }
    if (
      params.scheduleTime !== undefined &&
      params.scheduleTime !== current.scheduleTime
    ) {
      set('scheduleTime', params.scheduleTime);
    }
    if (params.enabled !== undefined && params.enabled !== current.enabled) {
      set('enabled', params.enabled);
    }
    // 시각을 바꾸거나 다시 켠 직후 이미 지나간 예약 시각을 뒤늦게 실행하지 않는다.
    if (changes.scheduleTime !== undefined || changes.enabled === true) {
      changes.scheduleCursorAt = new Date();
    }

    const target = await this.targetRepository.update(id, changes);
    if (!target) {
      throw new NotFoundException('등록되지 않은 정리 대상입니다.');
    }
    return { target, changedFields };
  }

  /** 설정과 실행 이력만 지운다. 지울 때 남긴 백업 파일은 그대로 둔다. */
  async remove(id: string): Promise<WorktreeCleanupTarget> {
    const target = await this.targetRepository.findById(id);
    if (!target) {
      throw new NotFoundException('등록되지 않은 정리 대상입니다.');
    }
    if (this.runner.isRunning(target.id)) {
      throw new ConflictException(
        '정리가 진행 중인 대상은 삭제할 수 없습니다.',
      );
    }
    await this.targetRepository.remove(target.id);
    return target;
  }

  private normalizeBaseRefs(baseRefs: string[]): string[] {
    const normalized = [
      ...new Set(baseRefs.map((ref) => ref.trim()).filter(Boolean)),
    ];
    if (normalized.length === 0) {
      throw new BadRequestException('기준 브랜치를 하나 이상 지정해야 합니다.');
    }
    if (normalized.some((ref) => !isValidBaseRef(ref))) {
      throw new BadRequestException('기준 브랜치 형식이 올바르지 않습니다.');
    }
    return normalized;
  }
}
