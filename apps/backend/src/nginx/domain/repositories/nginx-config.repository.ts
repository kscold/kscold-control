import type {
  NginxSite,
  NginxSiteConfiguration,
} from '../types/nginx-site.type';

export interface INginxConfigRepository {
  list(): Promise<NginxSite[]>;
  read(name: string): NginxSite | null;
  write(name: string, configuration: NginxSiteConfiguration): NginxSite;
  delete(name: string): void;
  toggle(name: string): { enabled: boolean };
}

export const NGINX_CONFIG_REPOSITORY = Symbol('NGINX_CONFIG_REPOSITORY');
