import { Container } from '../entities/container.entity';

/**
 * 컨테이너 영속성 저장소 계약임.
 * 도메인과 유스케이스는 TypeORM이나 PostgreSQL 구현 대신 이 계약만 사용함.
 */
export interface IContainerRepository {
  /**
   * 관리 UUID로 컨테이너 찾음.
   */
  findById(id: string): Promise<Container | null>;

  /**
   * Docker 엔진 식별자로 컨테이너 찾음.
   */
  findByDockerId(dockerId: string): Promise<Container | null>;

  /**
   * 컨테이너 이름으로 찾음.
   */
  findByName(name: string): Promise<Container | null>;

  /**
   * 모든 관리 컨테이너 찾음.
   */
  findAll(): Promise<Container[]>;

  /**
   * 특정 사용자가 소유한 관리 컨테이너 찾음.
   */
  findByUserId(userId: string): Promise<Container[]>;

  /**
   * 새 엔티티를 메모리에 만듦. 실제 저장은 save가 담당함.
   */
  create(data: Partial<Container>): Container;

  /**
   * 컨테이너 엔티티를 영속 저장소에 저장함.
   */
  save(container: Container): Promise<Container>;

  /**
   * 관리 UUID로 컨테이너 기록 삭제함.
   */
  delete(id: string): Promise<void>;

  /**
   * 관리 컨테이너의 마지막 알려진 상태 갱신함.
   */
  updateStatus(id: string, status: Container['status']): Promise<void>;
}

/**
 * Nest 의존성 주입에서 영속성 구현체를 연결하는 토큰임.
 */
export const CONTAINER_REPOSITORY = Symbol('CONTAINER_REPOSITORY');
