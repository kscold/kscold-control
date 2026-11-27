/**
 * 설치마다 다른 컨테이너 이름은 코드에 넣지 않고 .env 로 받는다 (공개 저장소).
 * - BLOG_CONTAINER: 블로그 로그 탭과 블로그 보조 컨테이너(agent·qdrant)를 묶을 부모 컨테이너
 * - MONGO_BACKUP_CONTAINERS: Docker 카드에 MongoDB 백업 버튼을 보일 컨테이너(쉼표 구분)
 */
export function blogContainerName(): string | null {
  return process.env.BLOG_CONTAINER?.trim() || null;
}

export function mongoBackupContainers(): Set<string> {
  return new Set(
    (process.env.MONGO_BACKUP_CONTAINERS ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
}
