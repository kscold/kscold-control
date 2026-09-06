import { isAbsolute, join, resolve } from 'path';

export function resolveFrontendDistPath(
  configuredPath = process.env.CONTROL_FRONTEND_DIST_PATH,
): string {
  if (configuredPath?.trim()) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }

  return join(__dirname, '..', '..', '..', '..', 'frontend', 'dist');
}
