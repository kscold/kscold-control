import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_BACKUP_RETENTION_DAYS,
  isValidScheduledBackupTargetName,
} from '../../domain/policies/scheduled-backup.policy';
import type { IScheduledBackupTargetRepository } from '../../domain/repositories/scheduled-backup-target.repository';
import type { ScheduledBackupTarget } from '../../domain/types/scheduled-backup.type';

/** image 를 지정하지 않은 대상에 쓰는 mongodump 실행 이미지 */
const DEFAULT_DUMP_IMAGE = 'mongo:7';

/** 공백·따옴표·역슬래시가 섞이면 컨테이너 안 설정 파일이 깨지므로 허용하지 않는다. */
const MONGODB_URI_PATTERN = /^mongodb(?:\+srv)?:\/\/[^\s"\\]+$/;

/** docker 인자로 들어가므로 옵션처럼 보이는 값(`-`로 시작)을 막는다. */
const DOCKER_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/;

const MAX_RETENTION_DAYS = 3650;

/** 예약 백업 대상을 SCHEDULED_MONGODB_BACKUPS 환경변수(JSON 배열)에서 읽는다. */
@Injectable()
export class EnvScheduledBackupTargetRepository implements IScheduledBackupTargetRepository {
  private readonly logger = new Logger(EnvScheduledBackupTargetRepository.name);
  private targets: ScheduledBackupTarget[] | null = null;

  findAll(): ScheduledBackupTarget[] {
    this.targets ??= this.load();
    return this.targets;
  }

  private load(): ScheduledBackupTarget[] {
    const raw = process.env.SCHEDULED_MONGODB_BACKUPS?.trim();
    if (!raw) {
      return [];
    }

    try {
      const targets = parseScheduledBackupTargets(raw);
      this.logger.log(
        `예약 백업 대상 ${targets.length}개 등록: ${targets.map((target) => target.name).join(', ')}`,
      );
      return targets;
    } catch (error) {
      // 설정 오류 때문에 관리 콘솔 전체가 뜨지 못하면 안 되므로 예약 백업만 끈다.
      this.logger.error(
        `SCHEDULED_MONGODB_BACKUPS 설정이 올바르지 않아 예약 백업을 실행하지 않습니다: ${(error as Error).message}`,
      );
      return [];
    }
  }
}

/**
 * 예약 백업 대상 설정을 해석한다.
 * 오류 메시지에는 URI 를 싣지 않는다. 자격증명이 로그에 남기 때문이다.
 */
export function parseScheduledBackupTargets(
  raw: string,
): ScheduledBackupTarget[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 파서 오류 메시지에는 입력 일부가 그대로 실리므로 버리고 고정 문구를 쓴다.
    throw new Error('JSON 형식이 아닙니다.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 배열이어야 합니다.');
  }

  const names = new Set<string>();

  return parsed.map((entry: unknown, index) => {
    const label = `${index + 1}번째 대상`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${label}이 객체가 아닙니다.`);
    }

    const { name, uri, retentionDays, image } = entry as Record<
      string,
      unknown
    >;

    if (typeof name !== 'string' || !isValidScheduledBackupTargetName(name)) {
      throw new Error(`${label}의 name 이 올바르지 않습니다.`);
    }
    if (names.has(name)) {
      throw new Error(`name 이 중복됩니다: ${name}`);
    }
    names.add(name);

    if (typeof uri !== 'string' || !MONGODB_URI_PATTERN.test(uri)) {
      throw new Error(
        `${name}: uri 는 mongodb:// 또는 mongodb+srv:// 로 시작하고 공백·따옴표·역슬래시가 없어야 합니다.`,
      );
    }

    const resolvedRetentionDays =
      retentionDays === undefined
        ? DEFAULT_BACKUP_RETENTION_DAYS
        : retentionDays;
    if (!isValidRetentionDays(resolvedRetentionDays)) {
      throw new Error(
        `${name}: retentionDays 는 1 이상 ${MAX_RETENTION_DAYS} 이하의 정수여야 합니다.`,
      );
    }

    const resolvedImage = image === undefined ? DEFAULT_DUMP_IMAGE : image;
    if (
      typeof resolvedImage !== 'string' ||
      !DOCKER_IMAGE_PATTERN.test(resolvedImage)
    ) {
      throw new Error(`${name}: image 형식이 올바르지 않습니다.`);
    }

    return {
      name,
      uri,
      retentionDays: resolvedRetentionDays,
      image: resolvedImage,
    };
  });
}

function isValidRetentionDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_RETENTION_DAYS
  );
}
