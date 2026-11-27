export const DNS_LOOKUP_GATEWAY = Symbol('DNS_LOOKUP_GATEWAY');

export interface IDnsLookupGateway {
  lookupPublicIp(provider: 'ipify' | 'ifconfig'): Promise<string>;
  resolveAddresses(domain: string): Promise<string[]>;
  resolveAliases(domain: string): Promise<string[]>;
}
