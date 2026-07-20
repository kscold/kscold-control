import { NotFoundException } from '@nestjs/common';

/**
 * 도메인 예외 클래스 모음
 * 도메인 엔티티를 찾지 못했을 때 사용한다.
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
