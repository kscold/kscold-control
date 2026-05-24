import { Body, Controller, Get, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { LogsService } from '../../application/services/logs.service';
import { LogType, type DockerLogFilter } from '../../domain/types/log.type';

@Controller('logs')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post('frontend-error')
  reportFrontendError(
    @Body()
    body: {
      message: string;
      stack?: string;
      componentStack?: string;
      url?: string;
    },
  ) {
    this.logsService.logFrontendError(body);
    return { ok: true };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getLogs(
    @Query('type') type: LogType,
    @Query('lines') lines?: string,
    @Query('containerId') containerId?: string,
    @Query('containerName') containerName?: string,
    @Query('timestamps') timestamps?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('filter') filter?: DockerLogFilter,
  ) {
    const lineCount =
      lines && lines !== 'all' ? parseInt(lines, 10) || 100 : 100;
    const dockerTail =
      type === 'docker'
        ? lines === 'all'
          ? 'all'
          : parseInt(lines ?? '', 10) || lineCount
        : undefined;
    const logs = await this.logsService.getLogs(type, lineCount, containerId, {
      containerName,
      tail: dockerTail,
      timestamps:
        type === 'docker' ? timestamps === 'true' || timestamps === '1' : false,
      since: type === 'docker' ? since : undefined,
      until: type === 'docker' ? until : undefined,
      filter: type === 'docker' ? filter ?? 'all' : 'all',
    });
    return {
      type,
      lines: type === 'docker' ? dockerTail ?? lineCount : lineCount,
      logs,
      meta:
        type === 'docker'
          ? {
              containerId,
              containerName,
              source: 'live',
              since: since ?? null,
              until: until ?? null,
              filter: filter ?? 'all',
              timestamps: timestamps === 'true' || timestamps === '1',
              requestedAt: new Date().toISOString(),
            }
          : undefined,
    };
  }

  /**
   * PM2 로그 조회
   */
  @Get('pm2')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getPm2Logs(@Query('lines') lines?: string) {
    const lineCount = lines ? parseInt(lines) : 100;
    return this.logsService.getPm2Logs(lineCount);
  }

  /**
   * Docker 컨테이너 목록
   */
  @Get('docker/containers')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getDockerContainers() {
    return this.logsService.getDockerContainers();
  }

  @Get('docker/archive/sources')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getDockerArchiveSources(@Query('containerId') containerId?: string) {
    if (!containerId) {
      return { items: [] };
    }

    const items = await this.logsService.getDockerArchiveSources(containerId);
    return { items };
  }

  @Get('docker/archive')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getDockerArchiveLogs(
    @Query('containerId') containerId?: string,
    @Query('containerName') containerName?: string,
    @Query('sourceId') sourceId?: string,
    @Query('lines') lines?: string,
    @Query('timestamps') timestamps?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('filter') filter?: DockerLogFilter,
  ) {
    if (!containerId || !sourceId) {
      return { lines: 0, sourceId, logs: [] };
    }

    const tail =
      lines === 'all' ? 'all' : parseInt(lines ?? '', 10) || 200;
    const logs = await this.logsService.getDockerArchiveLogs({
      containerId,
      containerName,
      sourceId,
      tail,
      timestamps: timestamps === 'true' || timestamps === '1',
      since,
      until,
      filter: filter ?? 'all',
    });

    return {
      sourceId,
      lines: tail,
      logs,
      meta: {
        containerId,
        containerName,
        source: 'archive',
        sourceId,
        since: since ?? null,
        until: until ?? null,
        filter: filter ?? 'all',
        timestamps: timestamps === 'true' || timestamps === '1',
        requestedAt: new Date().toISOString(),
      },
    };
  }

  @Get('docker/stream')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async streamDockerLogs(
    @Res() res: Response,
    @Request() req: ExpressRequest & JwtRequest,
    @Query('containerId') containerId?: string,
    @Query('containerName') containerName?: string,
    @Query('timestamps') timestamps?: string,
    @Query('since') since?: string,
    @Query('filter') filter?: DockerLogFilter,
  ) {
    if (!containerId) {
      res.status(400).json({ message: 'containerId is required' });
      return;
    }

    const streamOptions = {
      containerId,
      containerName,
      timestamps: timestamps === 'true' || timestamps === '1',
      since,
      filter: filter ?? 'all',
    } as const;

    const process = this.logsService.createDockerLogStream(streamOptions);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, payload: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send('ready', {
      containerId,
      containerName,
      userId: req.user?.id ?? req.user?.sub ?? null,
      connectedAt: new Date().toISOString(),
    });

    let buffer = '';
    let closed = false;
    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    const flushBuffer = (force = false) => {
      if (!buffer.trim() && !force) {
        return;
      }

      const parts = buffer.split(/\r?\n/);
      buffer = force ? '' : (parts.pop() ?? '');
      const filtered = this.logsService.filterDockerLogLines(
        parts.filter((line) => line.trim()),
        streamOptions,
      );

      filtered.forEach((line) => send('line', { line }));
    };

    const handleChunk = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      flushBuffer(false);
    };

    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      process.kill('SIGTERM');
      if (!res.writableEnded) {
        res.end();
      }
    };

    process.stdout.on('data', handleChunk);
    process.stderr.on('data', handleChunk);
    process.on('close', (code) => {
      flushBuffer(true);
      send('end', { code });
      close();
    });
    process.on('error', (error) => {
      send('error', { message: error.message });
      close();
    });

    req.on('close', close);
    res.on('close', close);
  }

  /**
   * Nginx 상태
   */
  @Get('nginx/status')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getNginxStatus() {
    return this.logsService.getNginxStatus();
  }

  /**
   * 시스템 정보
   */
  @Get('system')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getSystemInfo() {
    return this.logsService.getSystemInfo();
  }
}
