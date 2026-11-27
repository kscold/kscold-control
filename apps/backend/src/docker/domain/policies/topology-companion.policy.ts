export function classifyTopologyCompanion(
  containerName: string,
): { parentName: string; order: number } | null {
  const normalizedName = containerName.toLowerCase();
  if (
    !normalizedName.includes('vault-agent') &&
    !normalizedName.includes('blog-agent') &&
    !normalizedName.includes('vault-qdrant') &&
    !normalizedName.includes('blog-qdrant')
  ) {
    return null;
  }

  return {
    parentName: 'ubuntu-blog',
    order: normalizedName.includes('agent') ? 0 : 1,
  };
}
