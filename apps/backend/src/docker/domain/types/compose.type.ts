/**
 * Compose YAML에서 애플리케이션이 읽고 수정하는 최소 서비스 형태임.
 *
 * 전체 Compose 명세를 모델링하지 않고 서비스 생성·삭제·포트 확인에 필요한
 * 필드와 알 수 없는 확장 필드를 함께 보존함. 이 덕분에 사람이 추가한
 * Compose 옵션이 저장 과정에서 사라지지 않음.
 */
export interface ComposeServiceDefinition {
  image?: string;
  container_name?: string;
  command?: string;
  ports?: Array<string | number>;
  cpus?: string;
  mem_limit?: string;
  restart?: string;
  environment?: Record<string, string> | string[];
  depends_on?: string[] | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ComposeDocument {
  services?: Record<string, ComposeServiceDefinition>;
  [key: string]: unknown;
}
