import { ROLES } from '../constants/roles';
import { isGlobalAdministrator } from './role-access.util';

describe('isGlobalAdministrator', () => {
  it.each([
    [undefined, false],
    [[], false],
    [[ROLES.OPERATOR], false],
    [[ROLES.ADMIN], true],
    [[ROLES.SUPER_ADMIN], true],
    [[{ name: ROLES.ADMIN }], true],
    [[{ name: ROLES.SUPER_ADMIN }], true],
  ])('역할 %p의 전역 운영자 여부를 %p로 판별한다', (roles, expected) => {
    expect(isGlobalAdministrator(roles)).toBe(expected);
  });
});
