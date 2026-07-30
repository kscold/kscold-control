import { AxiosError } from 'axios';
import { api } from '@/shared/api/client';

/** MongoDB 백업 실행 결과 */
export interface MongodbBackupResult {
  success: boolean;
  path: string;
  size: string;
}

/**
 * 서버 응답에서 사용자에게 보여줄 메시지를 뽑는다.
 *
 * 서버는 { statusCode, message } 형태로 응답한다.
 * axios 기본 메시지("Request failed with status code 500")를 그대로 노출하면
 * 원인을 알 수 없으므로 서버 메시지를 우선한다.
 */
function toBackupError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const serverMessage = error.response?.data?.message;
    if (typeof serverMessage === 'string' && serverMessage) {
      return new Error(serverMessage);
    }
    return new Error('MongoDB 백업에 실패했습니다.');
  }
  return error instanceof Error
    ? error
    : new Error('MongoDB 백업에 실패했습니다.');
}

/**
 * 컨테이너 MongoDB 백업 API
 *
 * 공용 axios 인스턴스를 사용해 인증 토큰이 인터셉터에서 자동 주입되게 한다.
 * (직접 fetch + localStorage 로 토큰을 읽던 방식은 저장 키가 실제와 달라 항상 401 이었다)
 */
export const backupService = {
  async backupMongodb(containerName: string): Promise<MongodbBackupResult> {
    try {
      const { data } = await api.post<MongodbBackupResult>(
        `/system/backup/mongodb/${containerName}`,
      );
      return data;
    } catch (error) {
      throw toBackupError(error);
    }
  },
};
