import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveDockerProjectRoot(startDir: string): string {
  let currentDir = startDir;

  /*
   * 개발 환경의 src 경로와 배포 후 dist 경로는 깊이가 다름. 고정 상대 경로를
   * 쓰면 빌드 산출물에서 다른 파일을 읽거나 쓸 수 있으므로, 현재 파일 위치부터
   * 상위 디렉터리를 올라가 docker-compose.yml이 있는 프로젝트 루트 찾음.
   */
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'docker-compose.yml'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      /*
       * 임의의 현재 작업 디렉터리를 대신 반환하면 writeCompose가 전혀 다른 위치에
       * docker-compose.yml을 생성하거나 덮어쓸 수 있음. 구성 오류는 즉시
       * 드러내고 파일 변경은 하지 않는 편이 안전함.
       */
      throw new Error(
        `docker-compose.yml을 기준으로 프로젝트 루트를 찾지 못했습니다: ${startDir}`,
      );
    }

    currentDir = parentDir;
  }
}
