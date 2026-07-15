export interface MongodbBackupResult {
  path: string;
  size: string;
}

export interface MongodbBackupEntry {
  date: string;
  path: string;
  size: string;
}

export interface IMongodbBackupRepository {
  create(containerName: string): Promise<MongodbBackupResult>;
  list(containerName: string): Promise<MongodbBackupEntry[]>;
}

export const MONGODB_BACKUP_REPOSITORY = Symbol('MONGODB_BACKUP_REPOSITORY');
