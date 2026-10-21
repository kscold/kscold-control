/** 크기를 GiB/MiB 로 짧게 보여준다. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MiB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KiB`;
}
