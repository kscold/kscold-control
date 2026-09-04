import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore } from '@/shared/model';

export function PendingApprovalPage() {
  const { user, validateToken } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const check = async () => {
    setChecking(true);
    const valid = await validateToken();
    const refreshedUser = useAuthStore.getState().user;
    setChecking(false);
    if (
      valid &&
      refreshedUser?.permissions.includes(PERMISSIONS.SECRETS_READ)
    ) {
      navigate('/keys', { replace: true });
    }
  };

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-[#071018] p-6">
      <section className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-amber-300/20 bg-slate-950 shadow-2xl shadow-black/40">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.2),transparent_42%)] p-8 sm:p-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <Clock3 size={26} />
          </div>
          <p className="mt-7 text-xs font-semibold tracking-[0.2em] text-amber-300">
            ACCESS REQUEST RECEIVED
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            관리자 승인 대기 중
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
            {user?.email} 계정 요청이 접수됐습니다. 승인 전에는 운영 화면과
            API에 접근할 수 없습니다. 관리자가 GoLe 키 관리자 역할을 승인하면 이
            화면에서 바로 확인할 수 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => void check()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {checking ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              승인 상태 확인
            </button>
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={15} /> 15초마다 자동 확인
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
