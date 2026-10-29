import { Server } from 'lucide-react';
import {
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
  dialogInputClass,
} from '@/shared/ui';
import type { CreateNginxSiteDto } from '../model/nginx.types';

interface FlatUpstream {
  label: string;
  value: string;
  containerName: string;
}

interface SiteFormModalProps {
  editingName: string | null;
  form: CreateNginxSiteDto;
  setForm: (form: CreateNginxSiteDto) => void;
  allUpstreams: FlatUpstream[];
  onSubmit: () => void;
  onClose: () => void;
}

const FIELD_CLASS = dialogInputClass('blue');

export function SiteFormModal({
  editingName,
  form,
  setForm,
  allUpstreams,
  onSubmit,
  onClose,
}: SiteFormModalProps) {
  return (
    <Dialog
      open
      size="lg"
      title={editingName ? '사이트 수정' : '새 사이트 추가'}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className={dialogButtonClass('blue')}
          >
            {editingName ? '저장' : '추가'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="site-form-name" className={DIALOG_LABEL_CLASS}>
            설정 파일 이름
          </label>
          <input
            id="site-form-name"
            className={FIELD_CLASS}
            placeholder="예: my-app"
            value={form.name}
            disabled={!!editingName}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="site-form-domain" className={DIALOG_LABEL_CLASS}>
            도메인
          </label>
          <input
            id="site-form-domain"
            className={FIELD_CLASS}
            placeholder="예: app.example.com"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="site-form-upstream" className={DIALOG_LABEL_CLASS}>
            Upstream (프록시 대상)
          </label>
          {allUpstreams.length > 0 && (
            <div className="mb-2">
              <p className="mb-1.5 flex items-center gap-1 text-xs text-gray-500">
                <Server size={11} className="shrink-0" />
                실행 중인 컨테이너에서 선택:
              </p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
                {allUpstreams.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setForm({ ...form, upstream: u.value })}
                    className={`max-w-full truncate rounded-lg border px-2.5 py-1 text-xs transition ${
                      form.upstream === u.value
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      upstream: 'http://host.docker.internal:',
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    form.upstream.startsWith('http://host.docker.internal')
                      ? 'border-purple-500 bg-purple-600 text-white'
                      : 'border-gray-700 bg-gray-800 text-purple-300 hover:border-purple-500'
                  }`}
                >
                  Mac 호스트
                </button>
              </div>
            </div>
          )}
          <input
            id="site-form-upstream"
            className={FIELD_CLASS}
            placeholder="예: http://ubuntu-projectgamma:8080"
            value={form.upstream}
            onChange={(e) => setForm({ ...form, upstream: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.ssl}
              onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
              className="h-4 w-4 rounded accent-blue-500"
            />
            SSL (HTTPS)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.websocket}
              onChange={(e) =>
                setForm({ ...form, websocket: e.target.checked })
              }
              className="h-4 w-4 rounded accent-blue-500"
            />
            WebSocket
          </label>
        </div>
        {form.ssl && (
          <div className="space-y-3 rounded-lg border border-gray-800 p-3">
            <p className="text-xs text-gray-500">
              SSL 인증서 경로 (비워두면 기본 경로 사용)
            </p>
            <input
              aria-label="SSL 인증서 경로"
              className={FIELD_CLASS}
              placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/fullchain.pem`}
              value={form.sslCert}
              onChange={(e) => setForm({ ...form, sslCert: e.target.value })}
            />
            <input
              aria-label="SSL 개인 키 경로"
              className={FIELD_CLASS}
              placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/privkey.pem`}
              value={form.sslKey}
              onChange={(e) => setForm({ ...form, sslKey: e.target.value })}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
