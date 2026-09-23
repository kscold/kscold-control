import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PatchEnvironmentKeyDto } from '@/key-management/application/dto/patch-environment-key.dto';
import { RestoreSecretBackupDto } from '@/key-management/application/dto/restore-secret-backup.dto';
import { UpdateEnvironmentDto } from '@/key-management/application/dto/update-environment.dto';

const sshVersion = '0123456789abcdef'.repeat(4);
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const requests = [
  {
    name: 'PATCH key',
    metatype: PatchEnvironmentKeyDto,
    body: { secretValue: 'test-value' },
  },
  {
    name: 'PUT environment',
    metatype: UpdateEnvironmentDto,
    body: { envFile: 'TEST_KEY=test-value\n' },
  },
  { name: 'POST restore', metatype: RestoreSecretBackupDto, body: {} },
];

describe.each(requests)(
  '$name expectedVersion validation',
  ({ metatype, body }) => {
    const transform = (expectedVersion: unknown, extra = {}) =>
      pipe.transform(
        { ...body, expectedVersion, ...extra },
        { type: 'body', metatype },
      );

    it.each([
      ['SSH SHA-256 checksum', sshVersion],
      ['GCP numeric version', '123'],
    ])(
      'accepts the %s without changing its value',
      async (_provider, version) => {
        await expect(transform(version)).resolves.toHaveProperty(
          'expectedVersion',
          version,
        );
      },
    );

    it.each([
      undefined,
      123,
      '',
      'latest',
      `sha256:${sshVersion}`,
      sshVersion.slice(1),
      `${sshVersion}a`,
      sshVersion.toUpperCase(),
      `${sshVersion} `,
      'g'.repeat(64),
    ])('rejects an invalid or missing version: %p', async (version) => {
      await expect(transform(version)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('continues to reject unexpected request fields', async () => {
      await expect(
        transform(sshVersion, { skipBackup: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  },
);

it('still rejects a missing secretValue after accepting the SSH version', async () => {
  try {
    await pipe.transform(
      { expectedVersion: sshVersion },
      { type: 'body', metatype: PatchEnvironmentKeyDto },
    );
    throw new Error('Missing secretValue must be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const { message } = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    expect(message.some((entry) => entry.includes('secretValue'))).toBe(true);
    expect(message.some((entry) => entry.includes('expectedVersion'))).toBe(
      false,
    );
  }
});
