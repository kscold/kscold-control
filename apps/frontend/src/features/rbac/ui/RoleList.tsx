import { useState } from 'react';
import { Key } from 'lucide-react';
import type { Role } from '@/entities/user';

interface RoleListProps {
  roles: Role[];
}

/** 권한이 많은 역할은 처음에 이만큼만 보여 주고 나머지는 접어 둔다 (휴대폰에서 역할 하나가 화면을 다 차지했음) */
const PREVIEW_COUNT = 6;

function RolePermissions({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const shown = open
    ? role.permissions
    : role.permissions.slice(0, PREVIEW_COUNT);
  const hidden = role.permissions.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {shown.map((perm) => (
        <span
          key={perm.id}
          className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-blue-900 text-blue-200 rounded"
          title={perm.description}
        >
          {perm.name}
        </span>
      ))}
      {(hidden > 0 || open) && role.permissions.length > PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="px-2 py-0.5 sm:py-1 text-xs text-gray-300 rounded border border-gray-600 hover:text-white"
        >
          {open ? '접기' : `+${hidden}개 더`}
        </button>
      )}
    </div>
  );
}

/**
 * 역할 목록을 각 역할의 권한과 함께 보여준다
 */
export function RoleList({ roles }: RoleListProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
      <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
        <Key size={18} className="sm:w-5 sm:h-5" />
        역할 (Roles)
      </h2>
      <div className="space-y-2 sm:space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-gray-900/40 p-2.5 sm:p-3 rounded border border-gray-600"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-white font-medium text-sm sm:text-base">
                  {role.name}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    권한 {role.permissions.length}개
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-400">
                  {role.description}
                </p>
              </div>
            </div>
            <RolePermissions role={role} />
          </div>
        ))}
      </div>
    </div>
  );
}
