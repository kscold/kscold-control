/** parentName 은 블로그 본체 컨테이너 이름(BLOG_CONTAINER). 없으면 묶지 않는다 */
export function classifyTopologyCompanion(
  containerName: string,
  parentName: string | null,
): { parentName: string; order: number } | null {
  if (!parentName) return null;
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
    parentName,
    order: normalizedName.includes('agent') ? 0 : 1,
  };
}
