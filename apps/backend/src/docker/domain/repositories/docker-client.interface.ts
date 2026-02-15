/**
 * Docker Container Info
 * Information about a running Docker container
 */
export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: number;
}

/**
 * Docker Container Stats
 * Resource usage statistics
 */
export interface DockerContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkIn: number;
  networkOut: number;
}

/**
 * Docker Container Config
 * Configuration for creating a container
 */
export interface DockerContainerConfig {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
}

/**
 * Docker Client Interface
 * Abstracts Dockerode for testability
 */
export interface IDockerClient {
  /**
   * List all containers
   */
  listContainers(all?: boolean): Promise<DockerContainerInfo[]>;

  /**
   * Create a new container
   * @returns Docker container ID
   */
  createContainer(config: DockerContainerConfig): Promise<string>;

  /**
   * Start a container
   */
  startContainer(dockerId: string): Promise<void>;

  /**
   * Stop a container
   */
  stopContainer(dockerId: string): Promise<void>;

  /**
   * Remove a container
   */
  removeContainer(dockerId: string): Promise<void>;

  /**
   * Get container stats
   */
  getStats(dockerId: string): Promise<DockerContainerStats>;

  /**
   * Get container logs
   */
  getLogs(dockerId: string, lines?: number): Promise<string[]>;

  /**
   * Pull an image
   */
  pullImage(image: string): Promise<void>;

  /**
   * Inspect container
   */
  inspectContainer(dockerId: string): Promise<any>;
}

/**
 * Dependency Injection token
 */
export const DOCKER_CLIENT = Symbol('DOCKER_CLIENT');
