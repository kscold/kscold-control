import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import { User, Role, Permission } from '../model/types';
import {
  CreateUserRequest,
  UpdateUserRequest,
  AssignRolesRequest,
  UpdateTerminalLimitRequest,
  ImpersonationResponse,
  KeyManagementAccessMatrix,
  KeyManagementTargetAssignment,
} from './types';

/**
 * RBAC 관련 API 호출을 한곳에 모아둔 서비스
 */
export class RbacService extends BaseApiService {
  private readonly basePath = '/rbac';

  // ========== 사용자 관리 ==========

  /**
   * 전체 사용자를 역할 정보와 함께 조회한다
   * @returns 사용자 목록
   */
  async getUsers(): Promise<User[]> {
    try {
      const { data } = await api.get<User[]>(`${this.basePath}/users`);
      return data;
    } catch (error) {
      this.logError('RbacService', 'getUsers', error);
      this.handleError(error, 'Failed to load users');
    }
  }

  /**
   * 새 사용자를 생성한다
   * @param request 사용자 생성 데이터
   * @returns 생성된 사용자
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      const { data } = await api.post<User>(`${this.basePath}/users`, request);
      return data;
    } catch (error) {
      this.logError('RbacService', 'createUser', error);
      this.handleError(error, 'Failed to create user');
    }
  }

  /**
   * 사용자 정보를 수정한다
   * @param id 사용자 ID
   * @param request 수정할 데이터
   * @returns 수정된 사용자
   */
  async updateUser(id: string, request: UpdateUserRequest): Promise<User> {
    try {
      const { data } = await api.put<User>(
        `${this.basePath}/users/${id}`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'updateUser', error);
      this.handleError(error, 'Failed to update user');
    }
  }

  /**
   * 사용자를 삭제한다
   * @param id 사용자 ID
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/users/${id}`);
    } catch (error) {
      this.logError('RbacService', 'deleteUser', error);
      this.handleError(error, 'Failed to delete user');
    }
  }

  /**
   * 사용자에게 역할을 할당한다
   * @param userId 사용자 ID
   * @param request 역할 할당 데이터
   * @returns 수정된 사용자
   */
  async assignRoles(
    userId: string,
    request: AssignRolesRequest,
  ): Promise<User> {
    try {
      const { data } = await api.post<User>(
        `${this.basePath}/users/${userId}/roles`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'assignRoles', error);
      this.handleError(error, 'Failed to assign roles');
    }
  }

  /** 승인 대기 사용자를 운영 키 관리자로 전환한다. */
  async approveKeyManager(userId: string): Promise<User> {
    try {
      const { data } = await api.post<User>(
        `${this.basePath}/users/${userId}/approve-key-manager`,
      );
      return data;
    } catch (error) {
      this.handleError(error, '키 관리 접근 승인에 실패했습니다.');
    }
  }

  /** 사용자별로 접근할 수 있는 운영 키 대상을 조회한다. */
  async getKeyManagementTargetAccess(): Promise<KeyManagementAccessMatrix> {
    try {
      const { data } = await api.get<KeyManagementAccessMatrix>(
        `${this.basePath}/key-management-target-access`,
      );
      return data;
    } catch (error) {
      this.handleError(error, '운영 키 대상 범위를 불러오지 못했습니다.');
    }
  }

  /** 한 사용자의 운영 키 대상 범위를 원자적으로 교체한다. */
  async updateKeyManagementTargetAccess(
    userId: string,
    targetIds: string[],
  ): Promise<KeyManagementTargetAssignment> {
    try {
      const { data } = await api.put<KeyManagementTargetAssignment>(
        `${this.basePath}/users/${userId}/key-management-target-access`,
        { targetIds },
      );
      return data;
    } catch (error) {
      this.handleError(error, '운영 키 대상 범위를 변경하지 못했습니다.');
    }
  }

  /** 최고 관리자가 대상 사용자의 화면을 15분간 읽기 전용으로 미리 본다. */
  async startImpersonation(userId: string): Promise<ImpersonationResponse> {
    try {
      const { data } = await api.post<ImpersonationResponse>(
        `/auth/impersonation/${userId}`,
      );
      return data;
    } catch (error) {
      this.handleError(error, '사용자 화면 미리보기를 시작하지 못했습니다.');
    }
  }

  /**
   * 사용자의 터미널 명령어 사용 제한을 수정한다
   * @param userId 사용자 ID
   * @param request 터미널 제한 데이터
   * @returns 수정된 사용자
   */
  async updateTerminalLimit(
    userId: string,
    request: UpdateTerminalLimitRequest,
  ): Promise<User> {
    try {
      const { data } = await api.put<User>(
        `${this.basePath}/users/${userId}/terminal-limit`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'updateTerminalLimit', error);
      this.handleError(error, 'Failed to update terminal limit');
    }
  }

  /**
   * 사용자의 터미널 명령어 사용 횟수를 초기화한다
   * @param userId 사용자 ID
   */
  async resetTerminalCommandCount(userId: string): Promise<void> {
    try {
      await api.post(`${this.basePath}/users/${userId}/reset-terminal-limit`);
    } catch (error) {
      this.logError('RbacService', 'resetTerminalCommandCount', error);
      this.handleError(error, 'Failed to reset terminal command count');
    }
  }

  // ========== 역할 관리 ==========

  /**
   * 전체 역할을 권한 정보와 함께 조회한다
   * @returns 역할 목록
   */
  async getRoles(): Promise<Role[]> {
    try {
      const { data } = await api.get<Role[]>(`${this.basePath}/roles`);
      return data;
    } catch (error) {
      this.logError('RbacService', 'getRoles', error);
      this.handleError(error, 'Failed to load roles');
    }
  }

  // ========== 권한 관리 ==========

  /**
   * 사용 가능한 전체 권한을 조회한다
   * @returns 권한 목록
   */
  async getPermissions(): Promise<Permission[]> {
    try {
      const { data } = await api.get<Permission[]>(
        `${this.basePath}/permissions`,
      );
      return data;
    } catch (error) {
      this.logError('RbacService', 'getPermissions', error);
      this.handleError(error, 'Failed to load permissions');
    }
  }
}

// 싱글턴 인스턴스로 내보낸다
export const rbacService = new RbacService();
