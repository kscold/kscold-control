import { Container } from '../entities/container.entity';

/**
 * Container Repository Interface
 * Defines contract for container data access
 */
export interface IContainerRepository {
  /**
   * Find container by ID
   */
  findById(id: string): Promise<Container | null>;

  /**
   * Find container by Docker ID
   */
  findByDockerId(dockerId: string): Promise<Container | null>;

  /**
   * Find all containers
   */
  findAll(): Promise<Container[]>;

  /**
   * Find containers by user ID
   */
  findByUserId(userId: string): Promise<Container[]>;

  /**
   * Create a new container
   */
  create(data: Partial<Container>): Container;

  /**
   * Save container to database
   */
  save(container: Container): Promise<Container>;

  /**
   * Delete container by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Update container status
   */
  updateStatus(id: string, status: Container['status']): Promise<void>;
}

/**
 * Dependency Injection token
 */
export const CONTAINER_REPOSITORY = Symbol('CONTAINER_REPOSITORY');
