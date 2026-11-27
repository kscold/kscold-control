import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { ISshAllowUsersGateway } from '../../domain/gateways/ssh-allow-users.gateway.interface';

@Injectable()
export class FileSshAllowUsersGateway implements ISshAllowUsersGateway {
  async read(): Promise<string | null> {
    const path = process.env.SSH_ALLOW_USERS_CONFIG;
    return path ? readFile(path, 'utf8') : null;
  }
}
