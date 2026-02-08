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

    try {
      // df -k / 명령어로 루트 파티션 정보 가져오기 (KB 단위)
      const { stdout } = await execAsync('df -k /');
      const lines = stdout.trim().split('\n');

      if (lines.length >= 2) {
        // 두 번째 줄이 실제 데이터
        const parts = lines[1].split(/\s+/);

        // macOS의 df 출력 형식:
        // Filesystem   1024-blocks      Used Available Capacity  Mounted on
        // /dev/disk3s1   256901120  93163344 159827240    37%    /

        const totalKB = parseInt(parts[1]) || 0;
        const usedKB = parseInt(parts[2]) || 0;
        const availableKB = parseInt(parts[3]) || 0;

        diskInfo = {
          total: totalKB * 1024, // bytes
          used: usedKB * 1024,
          available: availableKB * 1024,
          usedPercent: totalKB > 0 ? (usedKB / totalKB) * 100 : 0,
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
      disk: diskInfo,
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
    };
  }
}
