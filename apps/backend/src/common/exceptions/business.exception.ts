import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

/**
 * Business Exception Classes
 * Used when business rules are violated
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
