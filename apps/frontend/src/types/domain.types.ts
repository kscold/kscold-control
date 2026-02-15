/**
 * Domain Types
 * Core business entities used throughout the application
 * Extracted from components to centralize type definitions
 */

// ============= RBAC Domain Types =============

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  email: string;
  roles: Role[];
  permissions?: string[]; // Flat list of permission names
  terminalCommandCount?: number;
  terminalCommandLimit?: number; // -1 = unlimited
}

// ============= Docker Domain Types =============

export interface ContainerPorts {
  [internalPort: string]: number; // externalPort
}

export interface ContainerResources {
  cpus: number;
  memory: string; // e.g., "4g", "512m"
}

export interface ExternalAccess {
  ssh?: string; // e.g., "ssh user@domain.com -p 2222"
  http?: string; // e.g., "http://domain.com:8001"
  domain: string;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string; // "created", "running", "exited", "stopped"
  ports: ContainerPorts;
  resources: ContainerResources;
  createdAt: string;
  liveStatus: string; // Real-time status from Docker
  externalAccess?: ExternalAccess;
  isManaged: boolean; // True if created by this system, False if external
}

export interface CreateContainerConfig {
  name: string;
  image: string;
  cpus: number;
  memory: string;
  sshPort: number;
  httpPort: number;
  environment?: Record<string, string>;
}

// ============= Terminal Domain Types =============

export interface TerminalSession {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: string;
  lastActivityAt?: string;
}

export interface TerminalMessage {
  id: string;
  sessionId: string;
  content: string;
  type: 'input' | 'output';
  timestamp: string;
}

// ============= System Domain Types =============

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  totalMemory: string;
  freeMemory: string;
  uptime: number;
  hostname: string;
}

// ============= Log Domain Types =============

export type LogType =
  | 'backend'
  | 'pm2'
  | 'nginx-access'
  | 'nginx-error'
  | 'docker';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
}
