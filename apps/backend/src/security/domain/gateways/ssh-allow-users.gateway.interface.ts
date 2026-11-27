export const SSH_ALLOW_USERS = Symbol('SSH_ALLOW_USERS');

export interface ISshAllowUsersGateway {
  read(): Promise<string | null>;
}
