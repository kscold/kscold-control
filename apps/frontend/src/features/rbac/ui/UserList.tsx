import { useState } from 'react';
import {
  Users,
  Edit2,
  Eye,
  Key,
  KeyRound,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { KeyManagementAccessTarget, User } from '@/entities/user';
import { ROLES } from '@/shared/config/roles';

interface UserListProps {
  users: User[];
  onAssignRoles: (user: User) => void;
  onUpdatePassword: (userId: string, password: string) => Promise<boolean>;
  onDelete: (userId: string, email: string) => void;
  onResetTerminalLimit: (userId: string) => void;
  onUpdateTerminalLimit: (userId: string, limit: number) => Promise<boolean>;
  onCreateUser: () => void;
  onApproveKeyManager: (userId: string) => Promise<boolean>;
  keyManagementTargets: KeyManagementAccessTarget[];
  keyManagementAssignments: Record<string, string[]>;
  onUpdateKeyManagementTargets: (
    userId: string,
    targetIds: string[],
  ) => Promise<boolean>;
  onPreviewUser: (user: User) => void;
}

const getRoleBadgeColor = (roleName: string) => {
  switch (roleName) {
    // admin 은 백엔드에서 super_admin 과 동일한 전역 권한을 가지므로 같은 색으로 표시한다
    case ROLES.ADMIN:
    case ROLES.SUPER_ADMIN:
      return 'bg-purple-600';
    case ROLES.OPERATOR:
      return 'bg-blue-600';
    case ROLES.READ_ONLY:
      return 'bg-gray-600';
    case ROLES.TERMINAL_ONLY:
      return 'bg-green-600';
    case ROLES.PENDING_APPROVAL:
      return 'bg-amber-600';
    case ROLES.KEY_MANAGER:
      return 'bg-cyan-700';
    default:
      return 'bg-gray-500';
  }
};

/**
 * 사용자 목록을 인라인 편집 기능과 함께 보여준다
 */
export function UserList({
  users,
  onAssignRoles,
  onUpdatePassword,
  onDelete,
  onResetTerminalLimit,
  onUpdateTerminalLimit,
  onCreateUser,
  onApproveKeyManager,
  keyManagementTargets,
  keyManagementAssignments,
  onUpdateKeyManagementTargets,
  onPreviewUser,
}: UserListProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editingTerminalLimitId, setEditingTerminalLimitId] = useState<
    string | null
  >(null);
  const [editTerminalLimit, setEditTerminalLimit] = useState<number>(10);
  const [editingTargetAccessId, setEditingTargetAccessId] = useState<
    string | null
  >(null);
  const [draftTargetIds, setDraftTargetIds] = useState<string[]>([]);

  const handleSavePassword = async (userId: string) => {
    const success = await onUpdatePassword(userId, editPassword);
    if (success) {
      setEditingUserId(null);
      setEditPassword('');
    }
  };

  const handleSaveTerminalLimit = async (userId: string) => {
    const success = await onUpdateTerminalLimit(userId, editTerminalLimit);
    if (success) {
      setEditingTerminalLimitId(null);
    }
  };

  const handleSaveTargetAccess = async (userId: string) => {
    const success = await onUpdateKeyManagementTargets(userId, draftTargetIds);
    if (success) setEditingTargetAccessId(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <Users size={18} className="sm:w-5 sm:h-5" />
          사용자 (Users)
        </h2>
        <button
          onClick={onCreateUser}
          className="px-2.5 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700"
        >
          + 생성
        </button>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {users.map((user) => {
          const isPending = user.roles.some(
            (role) => role.name === ROLES.PENDING_APPROVAL,
          );
          const terminalLimit = user.terminalCommandLimit ?? -1;
          const isGlobalAdmin = user.roles.some(
            (role) =>
              role.name === ROLES.ADMIN || role.name === ROLES.SUPER_ADMIN,
          );
          const isKeyManager = user.roles.some(
            (role) => role.name === ROLES.KEY_MANAGER,
          );
          const assignedTargetIds = isGlobalAdmin
            ? keyManagementTargets.map((target) => target.id)
            : (keyManagementAssignments[user.id] ?? []);
          return (
            <div
              key={user.id}
              className={`p-2.5 sm:p-3 rounded border ${
                isPending
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-gray-600 bg-gray-750'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm sm:text-base truncate">
                    {user.email}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <span
                          key={role.id}
                          className={`px-2 py-1 text-xs ${getRoleBadgeColor(role.name)} text-white rounded`}
                        >
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">역할 없음</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {editingTerminalLimitId === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editTerminalLimit}
                          onChange={(e) =>
                            setEditTerminalLimit(parseInt(e.target.value))
                          }
                          className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600"
                        >
                          <option value="0">차단 (0회)</option>
                          <option value="-1">무제한</option>
                          <option value="5">5회</option>
                          <option value="10">10회</option>
                          <option value="20">20회</option>
                          <option value="50">50회</option>
                          <option value="100">100회</option>
                        </select>
                        <button
                          onClick={() => handleSaveTerminalLimit(user.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingTerminalLimitId(null)}
                          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          터미널:{' '}
                          {terminalLimit === 0
                            ? '차단'
                            : `${user.terminalCommandCount || 0}/${
                                terminalLimit === -1
                                  ? '무제한'
                                  : `${terminalLimit}회`
                              }`}
                        </span>
                        {terminalLimit > 0 && (
                          <button
                            onClick={() => onResetTerminalLimit(user.id)}
                            className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            리셋
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingTerminalLimitId(user.id);
                            setEditTerminalLimit(
                              user.terminalCommandLimit ?? -1,
                            );
                          }}
                          className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                          title="제한 변경"
                        >
                          제한 변경
                        </button>
                      </div>
                    )}
                  </div>
                  {(isGlobalAdmin || isKeyManager) && (
                    <div className="mt-3 rounded-lg border border-cyan-400/20 bg-slate-950/35 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-100">
                          <KeyRound size={14} /> 운영 키 범위
                        </span>
                        {isGlobalAdmin ? (
                          <span className="text-[11px] text-slate-400">
                            관리자 전체 접근
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTargetAccessId(user.id);
                              setDraftTargetIds(assignedTargetIds);
                            }}
                            className="rounded border border-cyan-400/30 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/10"
                          >
                            범위 변경
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {assignedTargetIds.length > 0 ? (
                          keyManagementTargets
                            .filter((target) =>
                              assignedTargetIds.includes(target.id),
                            )
                            .map((target) => (
                              <span
                                key={target.id}
                                className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100"
                              >
                                {target.displayName}
                              </span>
                            ))
                        ) : (
                          <span className="text-[11px] text-amber-300">
                            배정된 운영 키 대상 없음
                          </span>
                        )}
                      </div>
                      {editingTargetAccessId === user.id && (
                        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                          {keyManagementTargets.map((target) => (
                            <label
                              key={target.id}
                              className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200"
                            >
                              <span>
                                {target.displayName}
                                <span className="ml-2 text-[10px] uppercase text-slate-500">
                                  {target.environment}
                                </span>
                              </span>
                              <input
                                type="checkbox"
                                checked={draftTargetIds.includes(target.id)}
                                onChange={(event) =>
                                  setDraftTargetIds((current) =>
                                    event.target.checked
                                      ? [...current, target.id]
                                      : current.filter(
                                          (id) => id !== target.id,
                                        ),
                                  )
                                }
                                className="h-4 w-4 accent-cyan-400"
                              />
                            </label>
                          ))}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleSaveTargetAccess(user.id)
                              }
                              className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400"
                            >
                              범위 저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTargetAccessId(null)}
                              className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {editingUserId === user.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="password"
                        placeholder="새 비밀번호"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600"
                      />
                      <button
                        onClick={() => handleSavePassword(user.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingUserId(null);
                          setEditPassword('');
                        }}
                        className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        취소
                      </button>
                    </div>
                  )}
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => void onApproveKeyManager(user.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
                    >
                      <UserCheck size={15} /> 대시보드 + 운영 키 관리자 승인
                    </button>
                  )}
                  {!isGlobalAdmin && (
                    <button
                      type="button"
                      onClick={() => onPreviewUser(user)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                      title="이 사용자의 권한으로 보이는 화면을 읽기 전용으로 확인"
                    >
                      <Eye size={15} /> QA 화면 보기
                    </button>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => onAssignRoles(user)}
                    className="p-2 text-blue-400 hover:text-blue-300"
                    title="역할 수정"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setEditingUserId(user.id)}
                    className="p-2 text-yellow-400 hover:text-yellow-300"
                    title="비밀번호 변경"
                  >
                    <Key size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(user.id, user.email)}
                    className="p-2 text-red-400 hover:text-red-300"
                    title="사용자 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
