import { BadRequestException } from '@nestjs/common';
import { EnvDocumentService } from '@/key-management/application/services/env-document.service';

const validEnv = `MONGODB_URI=mongodb://mongo:27017/gole
MONGODB_DATABASE=gole
REDIS_HOST=redis
REDIS_PORT=6379
GOLE_ENVIRONMENT=staging
PORTONE_ENABLED=false
`;

describe('EnvDocumentService', () => {
  const service = new EnvDocumentService({ get: jest.fn() } as any);

  it('키 값만 교체하고 나머지 줄은 보존한다', () => {
    const next = service.setKey(validEnv, 'PORTONE_ENABLED', 'true');

    expect(next).toContain('PORTONE_ENABLED=true\n');
    expect(next).toContain('MONGODB_DATABASE=gole\n');
    expect(service.changedKeys(validEnv, next)).toEqual(['PORTONE_ENABLED']);
  });

  it('중복 키를 거절한다', () => {
    expect(() =>
      service.normalizeAndValidate(`${validEnv}REDIS_HOST=duplicate\n`),
    ).toThrow(BadRequestException);
  });

  it('필수 키 누락을 거절한다', () => {
    expect(() =>
      service.normalizeAndValidate('GOLE_ENVIRONMENT=staging\n'),
    ).toThrow('필수 환경 변수 누락');
  });

  it('단일 키 API의 줄바꿈 주입을 거절한다', () => {
    expect(() =>
      service.setKey(validEnv, 'NEW_KEY', 'safe\nINJECTED=1'),
    ).toThrow(BadRequestException);
  });
});
