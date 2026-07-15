import { instanceToPlain } from 'class-transformer';
import { ComposeProvisioningTemplateResponseDto } from '@/docker/application/dto';

describe('ComposeProvisioningTemplateResponseDto', () => {
  it('선언한 기본값 필드만 응답 객체로 변환함', () => {
    const response = ComposeProvisioningTemplateResponseDto.from({
      name: 'ubuntu-blog',
      image: 'ubuntu:22.04',
      cpus: '2',
      memLimit: '4g',
      command: 'sleep infinity',
      ports: { '22': 2227, '8080': 8085 },
      internalOnly: '노출되면 안 됨',
    } as any);
    const plain = instanceToPlain(response, {
      excludeExtraneousValues: true,
    });

    expect(response).toBeInstanceOf(ComposeProvisioningTemplateResponseDto);
    expect(plain).toEqual({
      name: 'ubuntu-blog',
      image: 'ubuntu:22.04',
      cpus: '2',
      memLimit: '4g',
      command: 'sleep infinity',
      ports: { '22': 2227, '8080': 8085 },
    });
    expect(plain).not.toHaveProperty('internalOnly');
  });
});
