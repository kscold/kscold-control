export const SSH_ALLOW_USERS = Symbol('SSH_ALLOW_USERS');

export interface ISshAllowUsersGateway {
  read(): Promise<string | null>;
  protectedRule(): string | null;
  apply(
    revision: string,
    config: string,
  ): Promise<'applied' | 'conflict' | 'failed'>;
}
