import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Controller('system')
@UseGuards(AuthGuard('jwt'))
export class SystemController {
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
      const home = process.env.HOME || '/Users/' + process.env.USER;

      // df 와 카테고리별 du를 병렬로 실행
      const [dfResult, dockerResult, appsResult] = await Promise.all([
        execAsync('df -k /'),
        execAsync(`du -sk "${home}/Library/Containers/com.docker.docker" 2>/dev/null || echo "0\t-"`),
        execAsync(`du -sk /Applications 2>/dev/null || echo "0\t-"`),
      ]);

      // df 파싱
      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const totalKB = parseInt(parts[1]) || 0;
        const availableKB = parseInt(parts[3]) || 0;

        // macOS APFS는 여러 볼륨이 같은 컨테이너 공유
        // df "Used" = 루트 볼륨만 → 실제 사용량은 total - available
        const realUsedKB = totalKB - availableKB;

        diskInfo = {
          total: totalKB * 1024,
          used: realUsedKB * 1024,
          available: availableKB * 1024,
          usedPercent: totalKB > 0 ? (realUsedKB / totalKB) * 100 : 0,
        };

        // 카테고리별 breakdown
        const dockerKB = parseInt(dockerResult.stdout.trim().split(/\s+/)[0]) || 0;
        const appsKB = parseInt(appsResult.stdout.trim().split(/\s+/)[0]) || 0;
        const dockerBytes = dockerKB * 1024;
        const appsBytes = appsKB * 1024;
        const otherBytes = Math.max(0, diskInfo.used - dockerBytes - appsBytes);

        diskBreakdown = {
          docker: dockerBytes,
          applications: appsBytes,
          other: otherBytes,
        };
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
