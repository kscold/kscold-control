import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  FinalizedUpload,
  ProjectVersion,
  RepositoryFileInspection,
  StagedUploadInspection,
} from '../../domain/repositories/file-storage.interface';
import { RECEIPT_DIR, LocalStorageLayout } from './local-storage-layout';
import { LocalVersionStore } from './local-version-store';

type PublishReceiptState = 'prepared' | 'live_backed_up' | 'published';

interface PublishReceipt {
  protocolVersion: 1;
  projectName: string;
  sessionId: string;
  state: PublishReceiptState;
  version: ProjectVersion;
  ownsVersion?: boolean;
  publishedAt: string;
  updatedAt: string;
}

export class LocalUploadPublisher {
  constructor(
    private readonly layout: LocalStorageLayout,
    private readonly versions: LocalVersionStore,
    private readonly inspectDirectory: (
      root: string,
    ) => Promise<RepositoryFileInspection>,
    private readonly logger: Logger,
  ) {}

  async inspect(
    projectName: string,
    sessionId: string,
  ): Promise<StagedUploadInspection> {
    const stage = this.layout.stagingPath(projectName, sessionId);
    const receipt = await this.readReceipt(
      this.layout.receiptPath(projectName, sessionId),
    );
    const stageExists = await this.layout.exists(stage);
    if (receipt?.state === 'published') {
      if (stageExists) {
        await fs.rm(stage, { recursive: true, force: true });
      }
      return {
        ...(await this.inspectDirectory(this.layout.projectPath(projectName))),
        source: 'published',
      };
    }
    if (stageExists && receipt?.state !== 'live_backed_up') {
      return { ...(await this.inspectDirectory(stage)), source: 'staging' };
    }
    if (receipt?.state === 'live_backed_up') {
      await this.finishInterruptedPublish(receipt);
      return {
        ...(await this.inspectDirectory(this.layout.projectPath(projectName))),
        source: 'published',
      };
    }
    throw new Error('업로드 스테이징 디렉토리가 없습니다.');
  }

  async finalize(
    projectName: string,
    sessionId: string,
    versionOverride?: ProjectVersion,
  ): Promise<FinalizedUpload> {
    const receiptPath = this.layout.receiptPath(projectName, sessionId);
    const existingReceipt = await this.readReceipt(receiptPath);
    if (existingReceipt?.state === 'published') {
      await fs.rm(this.layout.stagingPath(projectName, sessionId), {
        recursive: true,
        force: true,
      });
      return {
        stats: (
          await this.inspectDirectory(this.layout.projectPath(projectName))
        ).stats,
        version: existingReceipt.version,
        publishedAt: existingReceipt.publishedAt,
      };
    }
    if (existingReceipt?.state === 'live_backed_up') {
      await this.finishInterruptedPublish(existingReceipt);
      return {
        stats: (
          await this.inspectDirectory(this.layout.projectPath(projectName))
        ).stats,
        version: existingReceipt.version,
        publishedAt: existingReceipt.publishedAt,
      };
    }

    const stage = this.layout.stagingPath(projectName, sessionId);
    const inspection = await this.inspectDirectory(stage);
    const version =
      existingReceipt?.version ??
      versionOverride ??
      (await this.versions.createSnapshot(projectName, stage));
    const publishedAt =
      existingReceipt?.publishedAt ?? new Date().toISOString();
    const receipt: PublishReceipt = existingReceipt ?? {
      protocolVersion: 1,
      projectName,
      sessionId,
      state: 'prepared',
      version,
      ownsVersion: versionOverride === undefined,
      publishedAt,
      updatedAt: publishedAt,
    };

    await this.writeReceipt(receiptPath, receipt);
    await this.publishPreparedStage(receipt);
    return { stats: inspection.stats, version, publishedAt };
  }

  async discard(projectName: string, sessionId: string): Promise<void> {
    const receiptPath = this.layout.receiptPath(projectName, sessionId);
    const receipt = await this.readReceipt(receiptPath);
    const backupExists = await this.layout.exists(
      this.layout.backupPath(projectName, sessionId),
    );
    if (
      receipt?.state === 'live_backed_up' ||
      (receipt?.state === 'prepared' && backupExists)
    ) {
      await this.finishInterruptedPublish(receipt);
      return;
    }

    await fs.rm(this.layout.stagingPath(projectName, sessionId), {
      recursive: true,
      force: true,
    });
    if (receipt?.state === 'prepared') {
      if (receipt.ownsVersion !== false) {
        await fs.rm(
          path.join(
            this.layout.versionDirectory(projectName),
            receipt.version.filename,
          ),
          { force: true },
        );
      }
      await fs.rm(receiptPath, { force: true });
    }
  }

  async recoverInterruptedPublishes(): Promise<void> {
    const projects = await this.layout.readDirectoryOrEmpty(
      this.layout.internalPath(RECEIPT_DIR),
    );
    for (const project of projects.filter((entry) => entry.isDirectory())) {
      if (!this.layout.isProjectName(project.name)) continue;
      const receiptDirectory = this.layout.internalProjectPath(
        RECEIPT_DIR,
        project.name,
      );
      const receipts = await this.layout.readDirectoryOrEmpty(receiptDirectory);

      for (const entry of receipts.filter(
        (item) => item.isFile() && item.name.endsWith('.json'),
      )) {
        try {
          await this.recoverReceipt(
            project.name,
            path.join(receiptDirectory, entry.name),
          );
        } catch (error) {
          this.logger.error(
            `업로드 복구 실패: ${project.name}/${entry.name} (${this.errorMessage(error)})`,
          );
        }
      }
    }
  }

  private async recoverReceipt(
    projectName: string,
    receiptPath: string,
  ): Promise<void> {
    const receipt = await this.readReceipt(receiptPath);
    if (!receipt) return;
    if (receipt.projectName !== projectName) {
      throw new Error('업로드 영수증의 프로젝트 정보가 일치하지 않습니다.');
    }
    const liveMissing = !(await this.layout.exists(
      this.layout.projectPath(receipt.projectName),
    ));
    const backupExists = await this.layout.exists(
      this.layout.backupPath(receipt.projectName, receipt.sessionId),
    );
    if (
      receipt.state === 'live_backed_up' ||
      (receipt.state === 'prepared' && liveMissing && backupExists)
    ) {
      await this.finishInterruptedPublish(receipt);
      this.logger.warn(
        `중단된 저장소 반영을 복구했습니다: ${receipt.projectName}/${receipt.sessionId}`,
      );
    } else if (receipt.state === 'published') {
      await fs.rm(
        this.layout.backupPath(receipt.projectName, receipt.sessionId),
        { recursive: true, force: true },
      );
    }
  }

  private async publishPreparedStage(receipt: PublishReceipt): Promise<void> {
    const live = this.layout.projectPath(receipt.projectName);
    const stage = this.layout.stagingPath(
      receipt.projectName,
      receipt.sessionId,
    );
    const backup = this.layout.backupPath(
      receipt.projectName,
      receipt.sessionId,
    );
    const receiptPath = this.layout.receiptPath(
      receipt.projectName,
      receipt.sessionId,
    );

    await fs.mkdir(path.dirname(backup), { recursive: true });
    if (await this.layout.exists(backup)) {
      if (
        !(await this.layout.exists(live)) &&
        (await this.layout.exists(stage))
      ) {
        receipt.state = 'live_backed_up';
        await this.writeReceipt(receiptPath, receipt);
        await this.finishInterruptedPublish(receipt);
        return;
      }
      if (
        (await this.layout.exists(live)) &&
        !(await this.layout.exists(stage))
      ) {
        receipt.state = 'published';
        await this.writeReceipt(receiptPath, receipt);
        await fs.rm(backup, { recursive: true, force: true });
        return;
      }
      throw new Error(
        '이전 업로드 복구 상태가 모호하여 라이브 반영을 중단했습니다.',
      );
    }
    if (await this.layout.exists(live)) await fs.rename(live, backup);

    receipt.state = 'live_backed_up';
    receipt.updatedAt = new Date().toISOString();
    await this.writeReceipt(receiptPath, receipt);
    try {
      await fs.rename(stage, live);
    } catch (error) {
      if (
        !(await this.layout.exists(live)) &&
        (await this.layout.exists(backup))
      ) {
        await fs.rename(backup, live);
      }
      receipt.state = 'prepared';
      receipt.updatedAt = new Date().toISOString();
      await this.writeReceipt(receiptPath, receipt);
      throw error;
    }

    receipt.state = 'published';
    receipt.updatedAt = new Date().toISOString();
    await this.writeReceipt(receiptPath, receipt);
    await fs.rm(backup, { recursive: true, force: true });
  }

  private async finishInterruptedPublish(
    receipt: PublishReceipt,
  ): Promise<void> {
    const live = this.layout.projectPath(receipt.projectName);
    const stage = this.layout.stagingPath(
      receipt.projectName,
      receipt.sessionId,
    );
    const backup = this.layout.backupPath(
      receipt.projectName,
      receipt.sessionId,
    );
    const liveExists = await this.layout.exists(live);
    const stageExists = await this.layout.exists(stage);
    if (liveExists && stageExists) {
      throw new Error(
        '중단된 업로드에 라이브와 스테이징이 모두 남아 자동 복구를 중단했습니다.',
      );
    }
    if (!liveExists && stageExists) await fs.rename(stage, live);
    if (!(await this.layout.exists(live))) {
      if (await this.layout.exists(backup)) await fs.rename(backup, live);
      throw new Error(
        '중단된 업로드를 복구했지만 새 버전 반영은 완료되지 않았습니다.',
      );
    }

    receipt.state = 'published';
    receipt.updatedAt = new Date().toISOString();
    await this.writeReceipt(
      this.layout.receiptPath(receipt.projectName, receipt.sessionId),
      receipt,
    );
    await fs.rm(backup, { recursive: true, force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }

  private async readReceipt(
    receiptPath: string,
  ): Promise<PublishReceipt | null> {
    try {
      const receipt = JSON.parse(
        await fs.readFile(receiptPath, 'utf8'),
      ) as PublishReceipt;
      receipt.version.createdAt = new Date(receipt.version.createdAt);
      return receipt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private writeReceipt(
    receiptPath: string,
    receipt: PublishReceipt,
  ): Promise<void> {
    return this.layout.writeJsonAtomic(receiptPath, receipt);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
