import { useState } from 'react';
import { X } from 'lucide-react';
import { TTL_OPTIONS, type CreateIpBanInput } from '../model/security.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateIpBanInput) => Promise<void>;
}

export function AddBanModal({ open, onClose, onCreate }: Props) {
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h2 className="text-base font-semibold text-white">IP 차단 추가</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              IP 주소
            </span>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="예: 203.0.113.42"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              차단 사유 (선택)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: login 브루트포스 감지"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              만료 시간
            </span>
            <select
              value={ttlMinutes}
              onChange={(e) => setTtlMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TTL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? '적용 중…' : '차단 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
