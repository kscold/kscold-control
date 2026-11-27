export function isValidBackupContainerName(containerName: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName);
}
