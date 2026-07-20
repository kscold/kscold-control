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
  permissions?: string[]; // 권한 이름을 평탄하게 나열한 목록
  terminalCommandCount?: number;
  terminalCommandLimit?: number; // -1이면 무제한
}
