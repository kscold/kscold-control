import { UserRound } from 'lucide-react';
import { MfaSettingsSection } from '@/features/auth';
import { useAuthStore } from '@/shared/model';

export function AccountPage() {
  const email = useAuthStore((state) => state.user?.email);

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900 p-2.5 text-gray-300">
            <UserRound size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              내 계정
            </h1>
            <p className="truncate text-sm text-gray-500">{email}</p>
          </div>
        </div>
        <MfaSettingsSection />
      </div>
    </div>
  );
}
