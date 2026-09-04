import { MODULE_METADATA } from '@nestjs/common/constants';
import { NginxInfrastructureModule } from '@/nginx/nginx-infrastructure.module';
import { NginxModule } from '@/nginx/nginx.module';
import { SecurityModule } from '@/security/security.module';

describe('SecurityModule', () => {
  it('imports only the Nginx provider boundary needed by the blocklist writer', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      SecurityModule,
    ) as unknown[];

    expect(imports).toContain(NginxInfrastructureModule);
    expect(imports).not.toContain(NginxModule);
  });
});
