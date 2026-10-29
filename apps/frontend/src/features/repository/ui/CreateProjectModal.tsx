import { useState } from 'react';
import {
  DIALOG_INPUT_CLASS,
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
} from '@/shared/ui';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; description?: string }) => Promise<void>;
}

export function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
      setError('소문자/숫자/하이픈/언더스코어만 사용 가능합니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name, description: description.trim() || undefined });
      setName('');
      setDescription('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="새 프로젝트"
      onClose={onClose}
      busy={submitting}
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
            type="button"
            onClick={handleSubmit}
            disabled={!name || submitting}
            className={dialogButtonClass('blue')}
          >
            {submitting ? '생성 중...' : '생성'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="create-project-name" className={DIALOG_LABEL_CLASS}>
            프로젝트명
          </label>
          <input
            id="create-project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="sampleproject"
            className={DIALOG_INPUT_CLASS}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            소문자/숫자/하이픈/언더스코어
          </p>
        </div>

        <div>
          <label
            htmlFor="create-project-description"
            className={DIALOG_LABEL_CLASS}
          >
            설명 (선택)
          </label>
          <input
            id="create-project-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="회사 샘플 프로젝트 백엔드 소스"
            className={DIALOG_INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="break-words rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400"
          >
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
