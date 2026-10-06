import * as path from 'node:path';
import { getHomeDirectory } from '../../../common/utils';

/** MongoDB 백업을 대상(컨테이너·예약 백업 대상) 이름별로 모아 두는 최상위 디렉터리 */
export const MONGODB_BACKUP_ROOT = path.join(
  getHomeDirectory(),
  'Desktop',
  'server-logs',
  'mongodb-backups',
);
