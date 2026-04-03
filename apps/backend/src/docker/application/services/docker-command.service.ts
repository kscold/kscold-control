import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DEFAULT_DOCKER_HOST = 'unix:///Users/kscold/.colima/default/docker.sock';

@Injectable()
export class DockerCommandService {
  async run(command: string): Promise<string> {
    const dockerHost = process.env.DOCKER_HOST || DEFAULT_DOCKER_HOST;
    const { stdout, stderr } = await execAsync(
      `DOCKER_HOST=${dockerHost} ${command}`,
      { maxBuffer: 10 * 1024 * 1024 },
    );

    return `${stdout}${stderr}`.trim();
  }
}
