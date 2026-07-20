import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

/**
 * 비즈니스 예외 클래스 모음
 * 업무 규칙을 위반했을 때 사용한다.
 */

export class InsufficientPermissionsException extends ForbiddenException {
  constructor(requiredPermission?: string) {
    super(
      requiredPermission
        ? `Insufficient permissions. Required: ${requiredPermission}`
        : 'Insufficient permissions to perform this action',
    );
  }
}

export class TerminalLimitExceededException extends ForbiddenException {
  constructor(limit: number, current: number) {
    super(
      `Terminal command limit exceeded. Limit: ${limit}, Current: ${current}`,
    );
  }
}

export class InvalidPasswordException extends BadRequestException {
  constructor(reason?: string) {
    super(
      reason ||
        'Password does not meet security requirements (minimum 8 characters)',
    );
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`Email '${email}' is already registered`);
  }
}

export class InvalidResourceConfigException extends BadRequestException {
  constructor(reason: string) {
    super(`Invalid resource configuration: ${reason}`);
  }
}

export class RoleAlreadyAssignedException extends ConflictException {
  constructor(roleName: string) {
    super(`Role '${roleName}' is already assigned to this user`);
  }
}

export class CannotDeleteSystemRoleException extends ForbiddenException {
  constructor(roleName: string) {
    super(`Cannot delete system role '${roleName}'`);
  }
}
