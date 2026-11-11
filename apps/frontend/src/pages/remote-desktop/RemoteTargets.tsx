import { useState } from 'react';
import { KeyRound, MoreHorizontal, Plus, Power } from 'lucide-react';
import { addressOf, protocolOf, type Target } from './target-model';
import { wakeLabel, type WakeState } from './useRemoteTargets';

export function OnlinePill({ online }: { online: boolean | undefined }) {
  const label = online === undefined ? '확인 중' : online ? '켜짐' : '꺼짐';
  return (
    <span
      className={`desktop-pill ${
        online ? 'desktop-pill-on' : online === false ? 'desktop-pill-off' : ''
      }`}
    >
      <span role="img" aria-label={label} className="desktop-dot" />
      {label}
    </span>
  );
}

export function RemoteTargets({
  targets,
  selectedId,
  online,
  waking,
  error,
  disabled,
  onSelect,
  onConnect,
  onWake,
  onAdd,
  onEdit,
  onRemove,
}: {
  targets: Target[];
  selectedId: string;
  online: Record<string, boolean>;
  waking: Record<string, WakeState>;
  error: string;
  disabled: boolean;
  onSelect: (target: Target) => void;
  onConnect: (target: Target) => void;
  onWake: (target: Target) => void;
  onAdd: () => void;
  onEdit: (target: Target) => void;
  onRemove: (target: Target) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  return (
    <section aria-label="원격 접속 대상" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">원격 접속 대상</h2>
        <button className="desktop-button" disabled={disabled} onClick={onAdd}>
          <Plus size={15} />
          대상 추가
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-2.5">
        {targets.map((target) => {
          const selected = target.id === selectedId;
          const wake = waking[target.id];
          return (
            <li
              key={target.id}
              className={`desktop-target ${selected ? 'desktop-target-selected' : ''}`}
            >
              <button
                type="button"
                className="desktop-target-main"
                aria-pressed={selected}
                aria-label={`${target.name} 선택`}
                onClick={() => onSelect(target)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {target.name}
                  </span>
                  <span className="desktop-badge">
                    {protocolOf(target).toUpperCase()}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-gray-400">
                  {addressOf(target)}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <OnlinePill online={online[target.id]} />
                  {target.hasCredentials && (
                    <span className="desktop-pill">
                      <KeyRound size={11} />
                      계정 저장됨
                    </span>
                  )}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="desktop-button desktop-primary flex-1"
                  disabled={disabled}
                  aria-label={`${target.name} 연결`}
                  onClick={() => onConnect(target)}
                >
                  연결
                </button>
                {target.wakeMac && (
                  <button
                    className="desktop-button flex-1"
                    disabled={disabled || Boolean(wake)}
                    onClick={() => onWake(target)}
                  >
                    <Power size={14} />
                    {wake ? wakeLabel(wake) : '깨우기'}
                  </button>
                )}
                <div className="relative">
                  <button
                    className="desktop-button"
                    aria-label={`${target.name} 더 보기`}
                    aria-expanded={menu === target.id}
                    disabled={disabled}
                    onClick={() =>
                      setMenu(menu === target.id ? null : target.id)
                    }
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menu === target.id && (
                    <div role="menu" className="desktop-menu">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(null);
                          onEdit(target);
                        }}
                      >
                        편집
                      </button>
                      <button
                        role="menuitem"
                        className="text-red-300"
                        onClick={() => {
                          setMenu(null);
                          onRemove(target);
                        }}
                      >
                        {target.id === 'local' ? '저장 정보 지우기' : '삭제'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
      <details className="desktop-help">
        <summary>도움말</summary>
        <ul>
          <li>같은 망의 컴퓨터는 사설 IPv4 주소로 등록합니다.</li>
          <li>망 밖의 컴퓨터는 주소를 비우고 SSH 터널의 로컬 포트를 씁니다.</li>
          <li>MAC 주소를 넣으면 꺼진 컴퓨터를 깨울 수 있습니다.</li>
          <li>Windows(RDP)는 로그인 계정을 저장해야 연결됩니다.</li>
          <li>암호는 서버에 암호화해 보관하고 연결할 때만 씁니다.</li>
        </ul>
      </details>
    </section>
  );
}
