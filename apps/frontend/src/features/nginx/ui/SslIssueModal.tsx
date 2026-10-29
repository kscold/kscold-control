import { Lock } from 'lucide-react';
import {
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';

interface SslIssueModalProps {
  certForm: { domain: string; email: string; mode: string };
  setCertForm: (form: { domain: string; email: string; mode: string }) => void;
  issuing: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const FIELD_CLASS = dialogInputClass('green');

const MODES = [
  { value: 'webroot', label: 'Webroot' },
  { value: 'standalone', label: 'Standalone' },
] as const;

export function SslIssueModal({
  certForm,
  setCertForm,
  issuing,
  onClose,
  onSubmit,
}: SslIssueModalProps) {
  return (
    <Dialog
      open
      title="SSL 인증서 발급"
      icon={<Lock size={18} className="text-green-400" />}
      onClose={onClose}
      busy={issuing}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={issuing}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={issuing}
            className={dialogButtonClass('green')}
          >
            {issuing ? '발급 중...' : '발급'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="ssl-issue-domain" className={DIALOG_LABEL_CLASS}>
            도메인
          </label>
          <input
            id="ssl-issue-domain"
            className={FIELD_CLASS}
            placeholder="예: app.example.com"
            value={certForm.domain}
            onChange={(e) =>
              setCertForm({ ...certForm, domain: e.target.value })
            }
          />
        </div>
        <div>
          <label htmlFor="ssl-issue-email" className={DIALOG_LABEL_CLASS}>
            이메일 (Let's Encrypt 알림)
          </label>
          <input
            id="ssl-issue-email"
            type="email"
            className={FIELD_CLASS}
            placeholder="admin@example.com"
            value={certForm.email}
            onChange={(e) =>
              setCertForm({ ...certForm, email: e.target.value })
            }
          />
        </div>
        <fieldset>
          <legend className={DIALOG_LABEL_CLASS}>발급 방식</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {MODES.map((mode) => (
              <label
                key={mode.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-300"
              >
                <input
                  type="radio"
                  checked={certForm.mode === mode.value}
                  onChange={() =>
                    setCertForm({ ...certForm, mode: mode.value })
                  }
                  className="h-4 w-4 accent-green-500"
                />
                {mode.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {certForm.mode === 'webroot'
              ? 'Nginx가 실행 중일 때 사용 (도메인이 이미 프록시 설정됨)'
              : 'Nginx 일시 중지 후 발급 (새 도메인)'}
          </p>
        </fieldset>
      </div>
    </Dialog>
  );
}
