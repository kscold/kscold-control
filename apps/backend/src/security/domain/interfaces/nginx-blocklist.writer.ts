export const NGINX_BLOCKLIST_WRITER = Symbol('NGINX_BLOCKLIST_WRITER');

export interface INginxBlocklistWriter {
  apply(ips: string[]): Promise<{ reloaded: boolean; output: string }>;
}
