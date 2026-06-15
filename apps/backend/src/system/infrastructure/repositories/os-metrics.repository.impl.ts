import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import type { IOsMetricsRepository } from '../../domain/interfaces/os-metrics.repository';
import type {
  CpuStats,
  DiskBreakdown,
  DiskInfo,
  DockerStorageUsage,
  MemoryStats,
} from '../../domain/types/system-info.type';
import { parseDockerSystemDfOutput } from './docker-disk-usage.util';

const execAsync = promisify(exec);
const DEFAULT_DOCKER_HOST = 'unix:///Users/kscold/.colima/default/docker.sock';

@Injectable()
export class OsMetricsRepositoryImpl implements IOsMetricsRepository {
  private readonly logger = new Logger(OsMetricsRepositoryImpl.name);
  private readonly STATS_CACHE_TTL = 3 * 1000; // 3초
  private readonly DISK_CACHE_TTL = 60 * 1000; // 1분

  private statsCache: {
    data: { cpu: CpuStats; memory: MemoryStats };
    timestamp: number;
  } | null = null;
  private diskCache: {
    data: { diskInfo: DiskInfo; diskBreakdown: DiskBreakdown };
    timestamp: number;
  } | null = null;
  private prevCpuTimes: { idle: number; total: number } | null = null;

  async getCpuStats(): Promise<CpuStats> {
    const cached = await this.getStatsFromCache();
    return cached.cpu;
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const cached = await this.getStatsFromCache();
    return cached.memory;
  }

  async getDiskInfo(): Promise<DiskInfo & { breakdown: DiskBreakdown }> {
    const now = Date.now();

    if (
      this.diskCache &&
      now - this.diskCache.timestamp < this.DISK_CACHE_TTL
    ) {
      const { diskInfo, diskBreakdown } = this.diskCache.data;
      return {
        ...diskInfo,
        breakdown: {
          ...diskBreakdown,
          dockerUsage: {
            ...diskBreakdown.dockerUsage,
            lastCollectedAt: this.diskCache.timestamp,
            collectionState: 'fresh',
            warning: null,
          },
        },
      };
    }

    let diskInfo: DiskInfo = {
      total: 0,
      used: 0,
      available: 0,
      usedPercent: 0,
    };
    let diskBreakdown: DiskBreakdown = {
      docker: 0,
      applications: 0,
      other: 0,
      dockerUsage: this.createEmptyDockerUsage(),
    };

    try {
      const home = process.env.HOME || '/Users/' + process.env.USER;
      const dockerUsagePromise = this.getDockerStorageUsage(home);

      const [dfResult, appsResult, dockerUsage] = await Promise.all([
        execAsync('df -k /'),
        execAsync(`du -sk /Applications 2>/dev/null || echo "0\t-"`),
        dockerUsagePromise,
      ]);

      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const totalKB = parseInt(parts[1]) || 0;
        const availableKB = parseInt(parts[3]) || 0;
        const realUsedKB = totalKB - availableKB;

        diskInfo = {
          total: totalKB * 1024,
          used: realUsedKB * 1024,
          available: availableKB * 1024,
          usedPercent: totalKB > 0 ? (realUsedKB / totalKB) * 100 : 0,
        };

        const appsKB = parseInt(appsResult.stdout.trim().split(/\s+/)[0]) || 0;
        const appsBytes = appsKB * 1024;
        const dockerBytes = Math.min(
          dockerUsage.storagePathSize || dockerUsage.total,
          Math.max(0, diskInfo.used - appsBytes),
        );

        diskBreakdown = {
          docker: dockerBytes,
          applications: appsBytes,
          other: Math.max(0, diskInfo.used - dockerBytes - appsBytes),
          dockerUsage,
        };
      }

      this.diskCache = { data: { diskInfo, diskBreakdown }, timestamp: now };
    } catch (error) {
      this.logger.error('Failed to get disk info:', error);

      if (this.diskCache) {
        const { diskInfo: cachedDiskInfo, diskBreakdown: cachedBreakdown } =
          this.diskCache.data;

        return {
          ...cachedDiskInfo,
          breakdown: {
            ...cachedBreakdown,
            dockerUsage: {
              ...cachedBreakdown.dockerUsage,
              lastCollectedAt: this.diskCache.timestamp,
              collectionState: 'stale',
              warning: '최근 수집값을 유지하고 있습니다.',
            },
          },
        };
      }
    }

    return {
      ...diskInfo,
      breakdown: {
        ...diskBreakdown,
        dockerUsage: {
          ...diskBreakdown.dockerUsage,
          lastCollectedAt: now,
          collectionState: 'fresh',
          warning: null,
        },
      },
    };
  }

  getSystemMeta(): { platform: string; hostname: string; uptime: number } {
    return {
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
    };
  }

  private async getStatsFromCache(): Promise<{
    cpu: CpuStats;
    memory: MemoryStats;
  }> {
    const now = Date.now();

    if (
      this.statsCache &&
      now - this.statsCache.timestamp < this.STATS_CACHE_TTL
    ) {
      return this.statsCache.data;
    }

    const cpu = this.calculateCpuUsage();
    const memory = await this.calculateMemoryUsage();

    const data = { cpu, memory };
    this.statsCache = { data, timestamp: now };
    return data;
  }

  private calculateCpuUsage(): CpuStats {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.irq +
        cpu.times.idle;
    }

    let cpuUsage = 0;
    if (this.prevCpuTimes) {
      const idleDelta = idle - this.prevCpuTimes.idle;
      const totalDelta = total - this.prevCpuTimes.total;
      cpuUsage =
        totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
    }
    this.prevCpuTimes = { idle, total };

    return {
      usage: Math.round(cpuUsage * 10) / 10,
      count: cpus.length,
      model: cpus[0]?.model || 'Unknown',
    };
  }

  private async calculateMemoryUsage(): Promise<MemoryStats> {
    const totalMem = os.totalmem();
    let appMem = 0;
    let availableMem = 0;

    try {
      const { stdout } = await execAsync('vm_stat');
      const pageSize = 16384;
      const parse = (key: string) => {
        const m = stdout.match(new RegExp(`${key}:\\s+(\\d+)`));
        return m ? parseInt(m[1]) * pageSize : 0;
      };
      const active = parse('Pages active');
      const wired = parse('Pages wired down');
      const speculative = parse('Pages speculative');
      const free = parse('Pages free');
      const inactive = parse('Pages inactive');
      appMem = active + wired;
      availableMem = free + inactive + speculative;
    } catch {
      appMem = totalMem - os.freemem();
      availableMem = os.freemem();
    }

    return {
      total: totalMem,
      used: appMem,
      free: availableMem,
      usedPercent: Math.round((appMem / totalMem) * 1000) / 10,
    };
  }

  private createEmptyDockerUsage(): DockerStorageUsage {
    return {
      total: 0,
      reclaimable: 0,
      storageLabel: 'Docker',
      storagePath: null,
      storagePathSize: 0,
      lastCollectedAt: null,
      collectionState: 'fresh',
      warning: null,
      images: { size: 0, reclaimable: 0, active: 0, totalCount: 0 },
      containers: { size: 0, reclaimable: 0, active: 0, totalCount: 0 },
      volumes: { size: 0, reclaimable: 0, active: 0, totalCount: 0 },
      buildCache: { size: 0, reclaimable: 0, active: 0, totalCount: 0 },
    };
  }

  private async getDockerStorageUsage(
    home: string,
  ): Promise<DockerStorageUsage> {
    const dockerUsage = this.createEmptyDockerUsage();
    const dockerHost = process.env.DOCKER_HOST || DEFAULT_DOCKER_HOST;

    try {
      const { stdout } = await execAsync(
        `DOCKER_HOST=${dockerHost} docker system df --format '{{json .}}'`,
      );
      Object.assign(dockerUsage, parseDockerSystemDfOutput(stdout));
    } catch (error) {
      this.logger.warn(
        `Failed to read docker system df: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const candidates = [
      { label: 'Colima VM', path: `${home}/.colima` },
      {
        label: 'Docker Desktop',
        path: `${home}/Library/Containers/com.docker.docker`,
      },
    ];

    const sizes = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const { stdout } = await execAsync(
            `du -sk "${candidate.path}" 2>/dev/null || echo "0\t-"`,
          );
          return {
            ...candidate,
            size: (parseInt(stdout.trim().split(/\s+/)[0], 10) || 0) * 1024,
          };
        } catch {
          return { ...candidate, size: 0 };
        }
      }),
    );

    const storage = sizes.sort((left, right) => right.size - left.size)[0];
    if (storage?.size) {
      dockerUsage.storageLabel = storage.label;
      dockerUsage.storagePath = storage.path;
      dockerUsage.storagePathSize = storage.size;
    }

    return dockerUsage;
  }
}
