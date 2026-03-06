export interface INginxRuntimeRepository {
  testConfig(): Promise<{ success: boolean; output: string }>;
  reload(): Promise<{ success: boolean; output: string }>;
  stop(): Promise<void>;
  start(): Promise<void>;
}

export const NGINX_RUNTIME_REPOSITORY = Symbol('NGINX_RUNTIME_REPOSITORY');
