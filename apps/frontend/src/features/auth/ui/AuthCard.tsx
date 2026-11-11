import type { ReactNode } from 'react';

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#071018] p-4">
      <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="mx-auto mb-5 h-14 w-14 overflow-hidden rounded-2xl border border-sky-400/20 bg-slate-950 shadow-lg shadow-sky-950/50">
            <img
              src="/favicon.svg"
              alt="kscold-control"
              className="h-full w-full"
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthStepHeading({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <>
      <h1 className="text-center text-2xl font-bold text-white">{title}</h1>
      <p className="mb-6 mt-2 break-keep text-center text-sm leading-6 text-slate-500">
        {description}
      </p>
    </>
  );
}
