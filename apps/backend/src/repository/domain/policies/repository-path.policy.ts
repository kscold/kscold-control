const SENSITIVE_FILE_NAMES = new Set([
  '.env',
  '.envrc',
  '.git-credentials',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.vault-token',
  'auth.json',
  'credentials.json',
  'secrets.json',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'kubeconfig',
]);
const SENSITIVE_DIRECTORY_NAMES = new Set([
  '.ssh',
  '.aws',
  '.gnupg',
  '.kube',
  '.docker',
  '.azure',
  '.terraform',
  '.pulumi',
]);
const RESERVED_ROOT_NAMES = new Set([
  '.versions',
  '.upload-sessions',
  '.upload-staging',
  '.upload-receipts',
  '.upload-backups',
  '.repository-versions',
]);
const SAFE_ENV_SUFFIXES = ['.example', '.sample', '.template'];

export function isSensitiveRepositoryPath(relativePath: string): boolean {
  const segments = relativePath
    .split('/')
    .map((segment) => segment.toLowerCase());
  const directories = segments.slice(0, -1);
  const fileName = segments.at(-1) ?? '';
  if (
    directories.some((segment) => SENSITIVE_DIRECTORY_NAMES.has(segment)) ||
    directories.some(
      (segment, index) =>
        segment === '.config' &&
        ['gcloud', 'gh', 'op'].includes(directories[index + 1]),
    )
  ) {
    return true;
  }
  if (
    SENSITIVE_FILE_NAMES.has(fileName) ||
    (fileName.startsWith('.env.') &&
      !SAFE_ENV_SUFFIXES.some((suffix) => fileName.endsWith(suffix)))
  ) {
    return true;
  }
  return (
    /(?:^|[-_.])service[-_]?account(?:[-_.]|$)/.test(fileName) ||
    /(?:^|[-_.])client[-_]?secret(?:[-_.]|$)/.test(fileName) ||
    /^terraform\.tfstate(?:\..+)?$/.test(fileName) ||
    /\.(?:pem|key|p12|pfx)$/.test(fileName)
  );
}

export function isReservedRepositoryPath(relativePath: string): boolean {
  return RESERVED_ROOT_NAMES.has(relativePath.split('/')[0]?.toLowerCase());
}

export function containsPrivateKeyMaterial(text: string): boolean {
  return (
    /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/.test(text) ||
    text.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')
  );
}
