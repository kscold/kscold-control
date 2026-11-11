import { ChevronLeft, ChevronRight } from 'lucide-react';
import { smallButton } from '../model/paging';

export function Pager({
  page,
  pages,
  total,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-500">
      <span>
        {total}개 중 {page + 1}/{pages}쪽
      </span>
      <button
        aria-label="이전 쪽"
        className={smallButton}
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft size={12} />
      </button>
      <button
        aria-label="다음 쪽"
        className={smallButton}
        disabled={page >= pages - 1}
        onClick={() => setPage(page + 1)}
      >
        <ChevronRight size={12} />
      </button>
    </div>
  );
}
