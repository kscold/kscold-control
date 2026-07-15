import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateNginxSiteDto } from '@/nginx/application/dto';
import { CreateNginxSiteRequestDto } from '@/nginx/presentation/dto';

describe('CreateNginxSiteRequestDto', () => {
  it('요청 문자열과 boolean 값을 정규화하고 유스케이스 DTO로 복사함', async () => {
    const request = plainToInstance(CreateNginxSiteRequestDto, {
      name: ' blog-api ',
      domain: ' blog.kscold.com ',
      upstream: ' https://blog:3000 ',
      ssl: 'true',
      sslCert: ' /etc/nginx/cert.pem ',
      sslKey: ' /etc/nginx/key.pem ',
      websocket: 'false',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request).toMatchObject({
      name: 'blog-api',
      domain: 'blog.kscold.com',
      upstream: 'https://blog:3000',
      ssl: true,
      sslCert: '/etc/nginx/cert.pem',
      sslKey: '/etc/nginx/key.pem',
      websocket: false,
    });

    const command = CreateNginxSiteDto.from({
      ...request,
      internalOnly: '유스케이스로 전달되면 안 됨',
    } as any);

    expect(command).toBeInstanceOf(CreateNginxSiteDto);
    expect(command).not.toHaveProperty('internalOnly');
  });

  it('선언하지 않은 요청 필드는 전역 화이트리스트 정책에서 거부함', async () => {
    const request = plainToInstance(CreateNginxSiteRequestDto, {
      name: 'blog-api',
      domain: 'blog.kscold.com',
      upstream: 'https://blog:3000',
      ssl: true,
      websocket: false,
      userId: '외부 요청으로는 허용되지 않음',
    });

    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toContain('userId');
  });
});
