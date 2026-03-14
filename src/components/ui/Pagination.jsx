import { useTranslation } from 'react-i18next';

const SIZE_OPTIONS = [25, 50, 100];

export default function Pagination({ page, totalPages, onPageChange, pageSize, onPageSizeChange, totalItems, safePage }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const current = safePage || page;

  if (totalItems === 0) return null;

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, totalItems);

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-3">
      {/* Items count + page size */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-muted dark:text-content-muted-dark">
          {isRTL ? `${start}–${end} من ${totalItems}` : `${start}–${end} of ${totalItems}`}
        </span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="text-[11px] px-1.5 py-0.5 rounded border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer outline-none"
        >
          {SIZE_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Prev / Next */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            disabled={current === 1}
            onClick={() => onPageChange(current - 1)}
            className={`px-3 py-1 rounded-md border border-edge dark:border-edge-dark text-xs ${current === 1 ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}
          >
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${current} من ${totalPages}` : `${current} of ${totalPages}`}
          </span>
          <button
            disabled={current === totalPages}
            onClick={() => onPageChange(current + 1)}
            className={`px-3 py-1 rounded-md border border-edge dark:border-edge-dark text-xs ${current === totalPages ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}
          >
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}
