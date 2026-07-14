// 사용자/역할/권한 도메인 모델

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
