import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZE_CLASS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const;

interface DialogProps {
  open: boolean;
  title: ReactNode;
  /** 제목 아래 한두 줄 설명 */
  description?: ReactNode;
  /** 제목 앞 아이콘 */
  icon?: ReactNode;
  size?: keyof typeof SIZE_CLASS;
  /** 'alertdialog' 는 확인·경고처럼 답을 받아야 하는 창 */
  role?: 'dialog' | 'alertdialog';
  onClose: () => void;
  /** 저장 중처럼 닫으면 안 될 때 true — Esc·바깥 누르기·닫기 버튼을 막는다 */
  busy?: boolean;
  /** 어두운 바깥을 눌러 닫을지. 기본은 확인 창만 닫고, 입력 양식은 실수로 닫히지 않게 둔다 */
  closeOnBackdrop?: boolean;
  /** 본문에 직접 그린 설명의 id. description 대신 본문 문단을 화면 낭독기에 연결할 때 쓴다 */
  describedById?: string;
  /** 오른쪽 위 닫기(X) 버튼. 확인 창처럼 버튼 줄로만 닫는 창은 끈다 */
  showCloseButton?: boolean;
  /** 주면 본문과 버튼 줄을 form 으로 감싸 Enter 로 제출할 수 있게 한다 */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  autoComplete?: 'on' | 'off';
  /** 아래 버튼 줄. 내용이 길어도 늘 보이도록 본문 스크롤과 따로 둔다 */
  footer?: ReactNode;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 여러 창이 겹쳐 열렸을 때 Esc·Tab 은 맨 위 창만 처리한다
const openStack: string[] = [];

/**
 * 모든 대화상자가 쓰는 틀.
 * 휴대폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 카드로 뜬다.
 * 높이는 화면(dvh) 안으로 제한하고 본문만 스크롤해서 제목과 버튼 줄이 화면 밖으로 밀려나지 않는다.
 */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return createPortal(<DialogPanel {...props} />, document.body);
}

function DialogPanel({
  title,
  description,
  icon,
  size = 'md',
  role = 'dialog',
  onClose,
  busy = false,
  closeOnBackdrop = role === 'alertdialog',
  describedById,
  showCloseButton = role === 'dialog',
  onSubmit,
  autoComplete,
  footer,
  children,
}: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    openStack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    // 안쪽 입력칸이 autoFocus 로 먼저 잡았으면 두고, 아니면 창 자체에 둔다 (휴대폰 키보드가 바로 뜨지 않게)
    if (!panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openStack.splice(openStack.indexOf(id), 1);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [id]);

  // Tab 으로 창 밖으로 나가지 않게 처음과 끝을 잇는다
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = [
      ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ].filter((item) => item.offsetParent !== null);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === panelRef.current)
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  // 안에서 끌어 선택하다 바깥에서 손을 떼도 닫히지 않게, 누른 곳과 뗀 곳이 모두 바깥일 때만 닫는다
  const handleBackdropDown = (event: MouseEvent<HTMLDivElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const fromBackdrop =
      pressedOnBackdrop.current && event.target === event.currentTarget;
    pressedOnBackdrop.current = false;
    if (fromBackdrop && closeOnBackdrop && !busy) onClose();
  };

  const body = (
    <>
      {children !== undefined && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-800 px-4 py-3 sm:px-5">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/60 backdrop-blur-[2px] motion-safe:animate-fade-in sm:items-center sm:p-4 ${
        role === 'alertdialog' ? 'z-[60]' : 'z-50'
      }`}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          describedById ?? (description ? descriptionId : undefined)
        }
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={`flex max-h-[calc(100dvh-0.75rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gray-700/80 bg-gray-900 pb-[env(safe-area-inset-bottom)] text-left shadow-2xl shadow-black/50 outline-none motion-safe:animate-sheet-in sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border-b sm:pb-0 ${SIZE_CLASS[size]}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-gray-800 px-4 py-3.5 sm:px-5">
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="break-words text-base font-semibold text-white"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 break-words text-xs leading-5 text-gray-400"
              >
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="닫기"
              className="-mr-1.5 -mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {onSubmit ? (
          <form
            onSubmit={onSubmit}
            autoComplete={autoComplete}
            className="flex min-h-0 flex-1 flex-col"
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
