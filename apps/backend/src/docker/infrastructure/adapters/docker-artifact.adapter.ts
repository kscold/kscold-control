import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPathInsideRoot } from '../../../common/utils';
import type { IDockerArtifactGateway } from '../../domain/gateways/docker-artifact.gateway.interface';
import type { DockerCleanupCandidateItem } from '../../domain/types/docker-cleanup.type';
import { resolveDockerProjectRoot } from '../lib/docker-project-root';

@Injectable()
export class DockerArtifactAdapter implements IDockerArtifactGateway {
  private readonly projectRoot = resolveDockerProjectRoot(__dirname);

  async listArtifacts(
    relativePaths: readonly string[],
  ): Promise<DockerCleanupCandidateItem[]> {
    const candidates: DockerCleanupCandidateItem[] = [];
    const candidateIds = new Set<string>();

    for (const relativePath of relativePaths) {
      const targetPath = this.resolveProjectPath(relativePath);
      if (!fs.existsSync(targetPath)) {
        continue;
      }

      const size = this.getPathSize(targetPath);
      if (size === null) {
        continue;
      }

      candidates.push({
        id: relativePath,
        label: relativePath,
        detail: '배포 부산물',
        size,
        readOnly: true,
      });
      candidateIds.add(relativePath);
    }

    const backupEntries = fs.readdirSync(this.projectRoot, {
      withFileTypes: true,
    });

    for (const entry of backupEntries) {
      if (!entry.name.includes('backup') || entry.isSymbolicLink()) {
        continue;
      }

      const relativePath = entry.name;
      if (candidateIds.has(relativePath)) {
        continue;
      }

      const entryPath = this.resolveProjectPath(relativePath);
      const size = this.getPathSize(entryPath);
      if (size === null) {
        continue;
      }

      candidates.push({
        id: relativePath,
        label: relativePath,
        detail: '백업 부산물',
        size,
        readOnly: true,
      });
      candidateIds.add(relativePath);
    }

    return candidates;
  }

  /**
   * 프로젝트 루트 밖의 경로는 정리 후보에 포함하지 않음.
   *
   * 현재 호출자는 고정된 경로 목록을 사용하지만, 게이트웨이는 독립적으로 안전해야 함.
   * 정규화 + 루트 포함 검사는 공용 유틸(isPathInsideRoot)에 위임해 ../ 또는 절대
   * 경로 우회를 막음. 예외 타입/메시지는 기존 그대로 유지함.
   */
  private resolveProjectPath(relativePath: string): string {
    const targetPath = path.resolve(this.projectRoot, relativePath);

    if (!isPathInsideRoot(this.projectRoot, targetPath)) {
      throw new Error(
        `프로젝트 루트 밖의 파일은 조사할 수 없습니다: ${relativePath}`,
      );
    }

    return targetPath;
  }

  /**
   * 파일 트리를 순회해 후보 용량 계산함.
   *
   * 심볼릭 링크는 링크 대상이 프로젝트 밖을 가리키거나 순환할 수 있어 따라가지
   * 않음. 파일이 삭제되는 경합 상황은 상위 collectSafely가 경고와 함께
   * 화면을 계속 보여 주도록 처리함.
   */
  private getPathSize(targetPath: string): number | null {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      return null;
    }

    if (stat.isFile()) {
      return stat.size;
    }

    if (!stat.isDirectory()) {
      return 0;
    }

    return fs.readdirSync(targetPath).reduce((sum, entry) => {
      return sum + (this.getPathSize(path.join(targetPath, entry)) ?? 0);
    }, 0);
  }
}
