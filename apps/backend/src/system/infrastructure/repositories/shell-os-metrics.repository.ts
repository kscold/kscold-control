import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import { exec, execFile } from 'child_process';
import { existsSync } from 'fs';
import { statfs } from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import type { IOsMetricsRepository } from '../../domain/repositories/os-metrics.repository.interface';
import type {
  CpuStats,
  DiskBreakdown,
  DiskInfo,
  DockerStorageUsage,
  MemoryStats,
} from '../../domain/types/system-info.type';
import { parseDockerSystemDfOutput } from '../../../common/utils/docker-disk-usage.util';
import { resolveDockerHost } from '../../../common/utils/docker-host.util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

@Injectable()
export class ShellOsMetricsRepository implements IOsMetricsRepository {
  private readonly logger = new Logger(ShellOsMetricsRepository.name);
  private readonly STATS_CACHE_TTL = 3 * 1000; // 3초
  private readonly DISK_CACHE_TTL = 60 * 1000; // 1분
  private readonly DISK_STALE_AFTER = 3 * 60 * 1000; // 3분
  /** docker·du 가 멈춰도 다음 측정을 막지 않도록 끊는 시간 */
  private readonly COMMAND_TIMEOUT = 90 * 1000;

  private statsCache: {
    data: { cpu: CpuStats; memory: MemoryStats };
    timestamp: number;
  } | null = null;
  private diskCache: {
    data: { diskInfo: DiskInfo; diskBreakdown: DiskBreakdown };
    timestamp: number;
  } | null = null;
  // 사용률은 두 시점의 차이로만 알 수 있다. 처음 부를 때 비교할 값이 없어 늘 0% 가 나오지 않도록 만들 때 한 번 재 둔다.
  private prevCpuTimes: { idle: number; total: number } = readCpuTimes();

  async getCpuStats(): Promise<CpuStats> {
    const cached = await this.getStatsFromCache();
    return cached.cpu;
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const cached = await this.getStatsFromCache();
    return cached.memory;
  }

  private diskRefresh: Promise<DiskInfo & { breakdown: DiskBreakdown }> | null =
    null;

  private diskTimer: NodeJS.Timeout | null = null;

  /**
   * 서버가 뜨자마자 한 번 재고, 그 뒤로는 화면을 열지 않아도 1분마다 다시 잰다.
   * 그래야 화면을 열 때 늘 1분 안쪽 값이 나온다.
   */
  onModuleInit() {
    void this.getDiskInfo();
    this.diskTimer = setInterval(
      () => void this.getDiskInfo(),
      this.DISK_CACHE_TTL,
    );
    this.diskTimer.unref();
  }

  onModuleDestroy() {
    if (this.diskTimer) clearInterval(this.diskTimer);
  }

  /**
   * docker system df 는 몇 초씩 걸린다. 지난 값이 있으면 바로 돌려주고,
   * 오래됐으면 뒤에서 한 번만 다시 잰다. 처음 한 번만 기다린다.
   */
  async getDiskInfo(): Promise<DiskInfo & { breakdown: DiskBreakdown }> {
    const cache = this.diskCache;
    const stale = !cache || Date.now() - cache.timestamp >= this.DISK_CACHE_TTL;
    if (stale && !this.diskRefresh) {
      this.diskRefresh = this.collectDiskInfo().finally(() => {
        this.diskRefresh = null;
      });
    }
    if (!cache) return this.diskRefresh!;
    return this.fromDiskCache(cache);
  }

  private fromDiskCache(
    cached: NonNullable<typeof this.diskCache>,
  ): DiskInfo & { breakdown: DiskBreakdown } {
    const { diskInfo, diskBreakdown } = cached.data;
    // 1분마다 다시 재므로, 세 번 넘게 못 잰 값일 때만 '지난 값'이라고 알린다.
    const stale = Date.now() - cached.timestamp >= this.DISK_STALE_AFTER;
    return {
      ...diskInfo,
      breakdown: {
        ...diskBreakdown,
        dockerUsage: {
          ...diskBreakdown.dockerUsage,
          lastCollectedAt: cached.timestamp,
          collectionState: stale ? 'stale' : 'fresh',
          warning: stale ? '최근 수집값을 유지하고 있습니다.' : null,
        },
      },
    };
  }

  private async collectDiskInfo(): Promise<
    DiskInfo & { breakdown: DiskBreakdown }
  > {
    const now = Date.now();

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
      const home = os.homedir();
      const dockerUsagePromise = this.getDockerStorageUsage(home);

      // df 대신 statfs 로 읽어 윈도우(시스템 드라이브)·리눅스·macOS 에서 같은 값을 쓴다.
      // /Applications 크기는 macOS 에만 있는 개념이라 그때만 잰다.
      const rootPath = os.platform() === 'win32' ? path.parse(home).root : '/';
      const [rootStats, appsBytes, dockerUsage] = await Promise.all([
        statfs(rootPath),
        os.platform() === 'darwin'
          ? this.measureDirectorySize('/Applications')
          : Promise.resolve(0),
        dockerUsagePromise,
      ]);

      {
        const total = rootStats.blocks * rootStats.bsize;
        const available = rootStats.bavail * rootStats.bsize;
        const realUsed = total - available;

        diskInfo = {
          total,
          used: realUsed,
          available,
          usedPercent: total > 0 ? (realUsed / total) * 100 : 0,
        };

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
    const { idle, total } = readCpuTimes(cpus);
    const idleDelta = idle - this.prevCpuTimes.idle;
    const totalDelta = total - this.prevCpuTimes.total;
    const cpuUsage =
      totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
    this.prevCpuTimes = { idle, total };

    return {
      usage: Math.round(cpuUsage * 10) / 10,
      count: cpus.length,
      model: cpus[0]?.model || 'Unknown',
    };
  }

  private async calculateMemoryUsage(): Promise<MemoryStats> {
    const totalMem = os.totalmem();
    let appMem: number;
    let availableMem: number;

    try {
      // vm_stat 은 macOS 에만 있다. 다른 운영체제는 아래 os.freemem 값으로 계산한다.
      if (os.platform() !== 'darwin') throw new Error('vm_stat 없음');
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

  /** du 로 폴더 크기를 잼. 폴더가 없으면 0, 재지 못하면 원인을 남기고 0. */
  private async measureDirectorySize(directory: string): Promise<number> {
    if (!existsSync(directory)) return 0;
    try {
      const { stdout } = await execFileAsync('du', ['-sk', directory], {
        timeout: this.COMMAND_TIMEOUT,
      });
      return (parseInt(stdout.trim().split(/\s+/)[0], 10) || 0) * 1024;
    } catch (error) {
      // 조회 실패를 0으로 돌려주면 디스크 사용량이 실제보다 적게 보인다.
      // 값은 0으로 두되 원인은 남겨 과소 표시를 알아챌 수 있게 한다.
      this.logger.warn(
        `디스크 사용량 조회 실패: ${directory} — ${(error as Error).message}`,
      );
      return 0;
    }
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
    const dockerHost = resolveDockerHost();

    try {
      // 셸 따옴표를 거치지 않도록 인자로 넘긴다(윈도우 cmd 는 작은따옴표를 모른다).
      const { stdout } = await execFileAsync(
        'docker',
        ['system', 'df', '--format', '{{json .}}'],
        {
          env: { ...process.env, DOCKER_HOST: dockerHost },
          timeout: this.COMMAND_TIMEOUT,
        },
      );
      Object.assign(dockerUsage, parseDockerSystemDfOutput(stdout));
    } catch (error) {
      this.logger.warn(
        `Failed to read docker system df: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Colima·Docker Desktop 의 디스크 이미지 위치는 macOS 기준이다. 다른 운영체제는 docker system df 값만 쓴다.
    const candidates =
      os.platform() === 'darwin'
        ? [
            { label: 'Colima VM', path: path.join(home, '.colima') },
            {
              label: 'Docker Desktop',
              path: path.join(
                home,
                'Library',
                'Containers',
                'com.docker.docker',
              ),
            },
          ]
        : [];

    const sizes = await Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        size: await this.measureDirectorySize(candidate.path),
      })),
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

function readCpuTimes(cpus: os.CpuInfo[] = os.cpus()): {
  idle: number;
  total: number;
} {
  let idle = 0;
  let total = 0;
  for (const { times } of cpus) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.irq + times.idle;
  }
  return { idle, total };
}
