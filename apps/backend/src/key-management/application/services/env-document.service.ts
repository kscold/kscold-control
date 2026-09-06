import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_ENV_BYTES = 128 * 1024;
const MAX_VALUE_LENGTH = 16 * 1024;

@Injectable()
export class EnvDocumentService {
  normalizeAndValidate(
    input: string,
    requiredKeys: readonly string[] = [],
  ): string {
    if (typeof input !== 'string' || input.includes('\0')) {
      throw new BadRequestException('올바른 .env 문자열이 아닙니다.');
    }

    const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (Buffer.byteLength(normalized, 'utf8') > MAX_ENV_BYTES) {
      throw new BadRequestException('.env 파일은 128KB를 넘을 수 없습니다.');
    }

    const values = this.parse(normalized);
    const missingKeys = requiredKeys.filter((key) => !values.has(key));
    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `필수 환경 변수 누락: ${missingKeys.join(', ')}`,
      );
    }

    return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
  }

  parse(input: string): Map<string, string> {
    const values = new Map<string, string>();
    const lines = input.split('\n');

    lines.forEach((line, index) => {
      if (!line.trim() || line.trimStart().startsWith('#')) {
        return;
      }

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        throw new BadRequestException(
          `.env ${index + 1}번째 줄 형식이 올바르지 않습니다. KEY=VALUE 형식을 사용하세요.`,
        );
      }

      const [, key, value] = match;
      if (values.has(key)) {
        throw new BadRequestException(`중복 환경 변수: ${key}`);
      }
      values.set(key, value);
    });

    if (values.size === 0) {
      throw new BadRequestException('.env에 환경 변수가 없습니다.');
    }
    return values;
  }

  listKeys(input: string): string[] {
    return Array.from(this.parse(input).keys()).sort();
  }

  changedKeys(before: string, after: string): string[] {
    const beforeValues = this.parse(before);
    const afterValues = this.parse(after);
    const keys = new Set([...beforeValues.keys(), ...afterValues.keys()]);

    return Array.from(keys)
      .filter((key) => beforeValues.get(key) !== afterValues.get(key))
      .sort();
  }

  setKey(
    input: string,
    key: string,
    secretValue: string,
    requiredKeys: readonly string[] = [],
  ): string {
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new BadRequestException('환경 변수 키 형식이 올바르지 않습니다.');
    }
    if (
      typeof secretValue !== 'string' ||
      secretValue.includes('\n') ||
      secretValue.includes('\r') ||
      secretValue.includes('\0') ||
      secretValue.length > MAX_VALUE_LENGTH
    ) {
      throw new BadRequestException(
        '단일 키 값은 줄바꿈 없이 16KB 이하여야 합니다.',
      );
    }

    const lines = input.replace(/\r\n?/g, '\n').split('\n');
    let replaced = false;
    const nextLines = lines.map((line) => {
      if (line.startsWith(`${key}=`)) {
        replaced = true;
        return `${key}=${secretValue}`;
      }
      return line;
    });

    if (!replaced) {
      while (nextLines.length > 0 && nextLines.at(-1) === '') {
        nextLines.pop();
      }
      nextLines.push(`${key}=${secretValue}`);
    }

    return this.normalizeAndValidate(`${nextLines.join('\n')}\n`, requiredKeys);
  }

  checksum(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }
}
