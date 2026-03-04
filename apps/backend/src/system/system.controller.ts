import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DISK_CACHE_TTL = 60 * 1000; // 1분
let diskCache: { data: any; timestamp: number } | null = null;

const STATS_CACHE_TTL = 3 * 1000; // 3초
let statsCache: { data: any; timestamp: number } | null = null;
let prevCpuTimes: { idle: number; total: number } | null = null;

@Controller('system')
@UseGuards(AuthGuard('jwt'))
export class SystemController {
  @Get('stats')
  async getStats() {
    const now = Date.now();
    if (statsCache && now - statsCache.timestamp < STATS_CACHE_TTL) {
      return statsCache.data;
    }

    // CPU 사용률 계산 (이전 샘플과 비교)
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
    if (prevCpuTimes) {
      const idleDelta = idle - prevCpuTimes.idle;
      const totalDelta = total - prevCpuTimes.total;
      cpuUsage =
        totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
    }
    prevCpuTimes = { idle, total };

    const totalMem = os.totalmem();

    // macOS: vm_stat으로 정확한 메모리 계산 (inactive/purgeable 제외)
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

    const data = {
      cpu: {
        usage: Math.round(cpuUsage * 10) / 10,
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
      },
      memory: {
        total: totalMem,
        used: appMem,
        free: availableMem,
        usedPercent: Math.round((appMem / totalMem) * 1000) / 10,
      },
      uptime: os.uptime(),
    };

    statsCache = { data, timestamp: now };
    return data;
  }

  @Get('info')
  async getSystemInfo() {
    // CPU 정보
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Unknown';

    // 메모리 정보
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // 디스크 정보 (macOS의 경우 df 명령어 사용)
    let diskInfo = {
      total: 0,
      used: 0,
      available: 0,
      usedPercent: 0,
    };
    let diskBreakdown = {
      docker: 0,
      applications: 0,
      other: 0,
    };

    try {
      const now = Date.now();

      // 캐시 유효하면 재사용 (du는 느리므로 1분 캐싱)
      if (diskCache && now - diskCache.timestamp < DISK_CACHE_TTL) {
        diskInfo = diskCache.data.diskInfo;
        diskBreakdown = diskCache.data.diskBreakdown;
      } else {
        const home = process.env.HOME || '/Users/' + process.env.USER;

        // df 와 카테고리별 du를 병렬로 실행
        const [dfResult, dockerResult, appsResult] = await Promise.all([
          execAsync('df -k /'),
          execAsync(
            `du -sk "${home}/Library/Containers/com.docker.docker" 2>/dev/null || echo "0\t-"`,
          ),
          execAsync(`du -sk /Applications 2>/dev/null || echo "0\t-"`),
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

          const dockerKB =
            parseInt(dockerResult.stdout.trim().split(/\s+/)[0]) || 0;
          const appsKB =
            parseInt(appsResult.stdout.trim().split(/\s+/)[0]) || 0;
          const dockerBytes = dockerKB * 1024;
          const appsBytes = appsKB * 1024;

          diskBreakdown = {
            docker: dockerBytes,
            applications: appsBytes,
            other: Math.max(0, diskInfo.used - dockerBytes - appsBytes),
          };
        }

        diskCache = { data: { diskInfo, diskBreakdown }, timestamp: now };
      }
    } catch (error) {
      console.error('Failed to get disk info:', error);
    }

    return {
      cpu: {
        count: cpuCount,
        model: cpuModel,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usedPercent: (usedMemory / totalMemory) * 100,
      },
      disk: { ...diskInfo, breakdown: diskBreakdown },
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
    };
  }
}
