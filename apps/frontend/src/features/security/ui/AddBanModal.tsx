import { useState } from 'react';
import {
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';
import { TTL_OPTIONS, type CreateIpBanInput } from '../model/security.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateIpBanInput) => Promise<void>;
}

const FIELD_CLASS = dialogInputClass('blue');

export function AddBanModal({ open, onClose, onCreate }: Props) {
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) {
      setError('IP 주소를 입력하세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        ip: ip.trim(),
        reason: reason.trim() || undefined,
        ttlMinutes: ttlMinutes > 0 ? ttlMinutes : undefined,
      });
      setIp('');
      setReason('');
      setTtlMinutes(0);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="IP 차단 추가"
      onClose={onClose}
      busy={submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={dialogButtonClass('red')}
          >
            {submitting ? '적용 중…' : '차단 추가'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="add-ban-ip" className={DIALOG_LABEL_CLASS}>
            IP 주소
          </label>
          <input
            id="add-ban-ip"
            type="text"
            inputMode="decimal"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="예: 203.0.113.42"
            className={FIELD_CLASS}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="add-ban-reason" className={DIALOG_LABEL_CLASS}>
            차단 사유 (선택)
          </label>
          <input
            id="add-ban-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: login 브루트포스 감지"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="add-ban-ttl" className={DIALOG_LABEL_CLASS}>
            만료 시간
          </label>
          <select
            id="add-ban-ttl"
            value={ttlMinutes}
            onChange={(e) => setTtlMinutes(Number(e.target.value))}
            className={FIELD_CLASS}
          >
            {TTL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="break-words rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
