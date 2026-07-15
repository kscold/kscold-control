import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContainerDto } from '@/docker/application/dto';
import { CreateContainerRequestDto } from '@/docker/presentation/dto';

describe('CreateContainerRequestDto', () => {
  it('문자열 입력을 정규화하고 유스케이스 입력으로 변환함', async () => {
    const request = plainToInstance(CreateContainerRequestDto, {
      name: ' blog-api ',
      image: ' ubuntu:22.04 ',
      ports: { ' 8080 ': '3000' },
      resources: { cpus: '2', memory: ' 4G ' },
      environment: { NODE_ENV: ' production ' },
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request).toMatchObject({
      name: 'blog-api',
      image: 'ubuntu:22.04',
      ports: { '8080': 3000 },
      resources: { cpus: 2, memory: '4g' },
      environment: { NODE_ENV: 'production' },
    });

    const command = CreateContainerDto.from({
      ...request,
      userId: 'user-1',
      untrusted: '제거되어야 함',
    } as any);

    expect(command).toMatchObject({
      name: 'blog-api',
      ports: { '8080': 3000 },
      userId: 'user-1',
    });
    expect(command).not.toHaveProperty('untrusted');
  });

  it('허용 범위를 벗어난 포트와 잘못된 환경 변수 형식을 거부함', async () => {
    const request = plainToInstance(CreateContainerRequestDto, {
      name: 'blog-api',
      image: 'ubuntu:22.04',
      ports: { '8080': '70000' },
      resources: { cpus: 2, memory: '4g' },
      environment: { 'NOT-VALID': 42 },
    });

    const errors = await validate(request);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['ports', 'environment']),
    );
  });

  it('선언하지 않은 요청 필드는 전역 화이트리스트 정책에서 거부함', async () => {
    const request = plainToInstance(CreateContainerRequestDto, {
      name: 'blog-api',
      image: 'ubuntu:22.04',
      ports: { '8080': 3000 },
      resources: { cpus: 2, memory: '4g' },
      userId: '외부 요청으로는 허용되지 않음',
    });

    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toContain('userId');
  });
});
