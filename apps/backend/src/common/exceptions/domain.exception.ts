import { NotFoundException } from '@nestjs/common';

/**
 * Domain Exception Classes
 * Used when domain entities are not found
 */

export class UserNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `User with identifier '${identifier}' not found`
        : 'User not found',
    );
  }
}

export class RoleNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Role with identifier '${identifier}' not found`
        : 'Role not found',
    );
  }
}

export class PermissionNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Permission with identifier '${identifier}' not found`
        : 'Permission not found',
    );
  }
}

export class ContainerNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Container with identifier '${identifier}' not found`
        : 'Container not found',
    );
  }
}

export class SessionNotFoundException extends NotFoundException {
  constructor(identifier?: string) {
    super(
      identifier
        ? `Session with identifier '${identifier}' not found`
        : 'Session not found',
    );
  }
}
