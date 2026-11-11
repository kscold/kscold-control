import { useState } from 'react';

export const smallButton =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-800 px-2 py-1 text-xs text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-40';

/** 긴 목록을 쪽으로 나눔 — 목록이 줄어 쪽이 사라지면 마지막 쪽으로 */
export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return {
    items: items.slice(current * size, current * size + size),
    page: current,
    pages,
    total: items.length,
    setPage,
  };
}
