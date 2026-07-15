import type { TransformFnParams } from 'class-transformer';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const ENVIRONMENT_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 문자열 입력의 앞뒤 공백 제거용 변환 함수임. */
export function normalizeTrimmedString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * 포트 맵의 외부 포트를 숫자로 변환하고 내부 포트 키의 공백 제거함.
 * 변환할 수 없는 값은 그대로 남겨 검증 단계에서 명확한 400 응답을 만들게 함.
 */
export function normalizePortMap({ value }: TransformFnParams): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([internalPort, externalPort]) => [
      internalPort.trim(),
      typeof externalPort === 'string' && externalPort.trim() !== ''
        ? Number(externalPort.trim())
        : externalPort,
    ]),
  );
}

/** 환경 변수 키와 문자열 값의 앞뒤 공백 제거용 변환 함수임. */
export function normalizeEnvironment({ value }: TransformFnParams): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.trim(),
      typeof entry === 'string' ? entry.trim() : entry,
    ]),
  );
}

/** 쿼리·본문의 true/false 문자열을 boolean으로 변환함. */
export function normalizeBoolean({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return value;
}

/** 내부·외부 포트가 모두 1~65535 정수인지 검증하는 데코레이터임. */
export function IsPortMap(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPortMap',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            isRecord(value) &&
            Object.entries(value).every(([internalPort, externalPort]) => {
              const internal = Number(internalPort);
              return (
                /^\d+$/.test(internalPort) &&
                Number.isInteger(internal) &&
                internal >= MIN_PORT &&
                internal <= MAX_PORT &&
                typeof externalPort === 'number' &&
                Number.isInteger(externalPort) &&
                externalPort >= MIN_PORT &&
                externalPort <= MAX_PORT
              );
            })
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property}의 내부·외부 포트는 1부터 65535 사이의 정수여야 함.`;
        },
      },
    });
}

/** 환경 변수 키와 값의 문자열 형식을 검증하는 데코레이터임. */
export function IsEnvironmentMap(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isEnvironmentMap',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            isRecord(value) &&
            Object.entries(value).every(
              ([key, entry]) =>
                ENVIRONMENT_KEY.test(key) && typeof entry === 'string',
            )
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property}의 키는 환경 변수 이름 형식이고 값은 문자열이어야 함.`;
        },
      },
    });
}
