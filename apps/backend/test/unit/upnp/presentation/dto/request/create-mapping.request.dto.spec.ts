import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddPortMappingDto } from '@/upnp/application/dto';
import { CreateMappingRequestDto } from '@/upnp/presentation/dto';

describe('CreateMappingRequestDto', () => {
  it('포트와 프로토콜을 정규화하고 도메인 구성값으로 변환함', async () => {
    const request = plainToInstance(CreateMappingRequestDto, {
      publicPort: '8080',
      privatePort: '3000',
      protocol: ' tcp ',
      description: ' blog api ',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request).toMatchObject({
      publicPort: 8080,
      privatePort: 3000,
      protocol: 'TCP',
      description: 'blog api',
    });

    const command = AddPortMappingDto.from({
      ...request,
      internalOnly: '유스케이스로 전달되면 안 됨',
    } as any);

    expect(command).toBeInstanceOf(AddPortMappingDto);
    expect(command.toDraft()).toEqual({
      publicPort: 8080,
      privatePort: 3000,
      protocol: 'TCP',
      description: 'blog api',
    });
    expect(command).not.toHaveProperty('internalOnly');
  });

  it('선언하지 않은 요청 필드는 전역 화이트리스트 정책에서 거부함', async () => {
    const request = plainToInstance(CreateMappingRequestDto, {
      publicPort: 8080,
      privatePort: 3000,
      elevated: true,
    });

    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toContain('elevated');
  });
});
