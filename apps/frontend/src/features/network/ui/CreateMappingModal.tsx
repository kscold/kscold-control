import { Network } from 'lucide-react';
import {
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';
import type { CreateMappingForm } from '../model/network.types';

interface CreateMappingModalProps {
  form: CreateMappingForm;
  setForm: (form: CreateMappingForm) => void;
  submitting: boolean;
  canSubmit: boolean;
  externalIp: string;
  onSubmit: () => void;
  onClose: () => void;
}

const FIELD_CLASS = dialogInputClass('purple');

export function CreateMappingModal({
  form,
  setForm,
  submitting,
  canSubmit,
  externalIp,
  onSubmit,
  onClose,
}: CreateMappingModalProps) {
  return (
    <Dialog
      open
      title="포트 매핑 추가"
      icon={<Network size={18} className="text-purple-400" />}
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
            onClick={onSubmit}
            disabled={submitting || !canSubmit}
            className={dialogButtonClass('purple')}
          >
            {submitting ? '추가 중...' : '추가'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="mapping-public-port" className={DIALOG_LABEL_CLASS}>
              외부 포트
            </label>
            <input
              id="mapping-public-port"
              type="number"
              inputMode="numeric"
              className={FIELD_CLASS}
              placeholder="예: 8080"
              value={form.publicPort}
              onChange={(e) => setForm({ ...form, publicPort: e.target.value })}
              min="1"
              max="65535"
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="mapping-private-port"
              className={DIALOG_LABEL_CLASS}
            >
              내부 포트
            </label>
            <input
              id="mapping-private-port"
              type="number"
              inputMode="numeric"
              className={FIELD_CLASS}
              placeholder="예: 8080"
              value={form.privatePort}
              onChange={(e) =>
                setForm({ ...form, privatePort: e.target.value })
              }
              min="1"
              max="65535"
            />
          </div>
        </div>
        <fieldset>
          <legend className={DIALOG_LABEL_CLASS}>프로토콜</legend>
          <div className="flex gap-4">
            {(['TCP', 'UDP'] as const).map((protocol) => (
              <label
                key={protocol}
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-300"
              >
                <input
                  type="radio"
                  checked={form.protocol === protocol}
                  onChange={() => setForm({ ...form, protocol })}
                  className="h-4 w-4 accent-purple-500"
                />
                {protocol}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="mapping-description" className={DIALOG_LABEL_CLASS}>
            설명
          </label>
          <input
            id="mapping-description"
            className={FIELD_CLASS}
            placeholder="예: Web Server"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="break-words rounded-lg bg-gray-800/50 p-3 text-xs leading-5 text-gray-400">
          <p>
            외부에서{' '}
            <span className="font-mono text-white">
              {externalIp || '공인IP'}:{form.publicPort || '?'}
            </span>{' '}
            접속 시
          </p>
          <p>
            로컬{' '}
            <span className="font-mono text-white">
              이 서버:{form.privatePort || '?'}
            </span>{' '}
            로 포워딩됩니다.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
