import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * DataTable — the ONE shared table for the whole app.
 *
 * Goal: every table looks and behaves the same, and a change to the fundamentals
 * (layout, density, sort UI, empty/loading states) is made HERE once and applies
 * everywhere. Replaces the per-page hand-rolled `<table>` markup.
 *
 * Layout is ALWAYS stable: the table is `table-fixed`, every column takes the
 * width you give it (text-heavy cells truncate with an ellipsis) so long values
 * never widen or shift the table. Give the primary column the largest width.
 *
 * Columns (each item):
 *   key         string   — unique id; also the default value accessor (row[key]).
 *   header      node     — column heading.
 *   width       number|string — column width (px number or CSS like '20%').
 *                          Set it on every column; a width-less column collapses
 *                          under table-fixed.
 *   align       'start'|'center'|'end'  (default 'start')
 *   hideBelow   'sm'|'md'|'lg'|'xl'  — hide the column below this breakpoint.
 *   render      (row, {isRTL}) => node — custom cell; falls back to row[key].
 *   truncate    boolean  — text cells truncate by default; a custom-render column
 *                          opts in with truncate:true. Set false to never clip.
 *   sortable    boolean  — header becomes a sort toggle (needs `onSort`).
 *   headerClassName / cellClassName — extra classes.
 *
 * Data & behaviour:
 *   rows, rowKey (string field or fn), onRowClick, rowClassName (string|fn).
 *   loading + skeletonRows — shimmer placeholder rows.
 *   empty | emptyText — shown when there are no rows.
 *   sortBy, sortDir ('asc'|'desc'), onSort(key) — controlled sorting.
 *   selectable, selectedIds (Set|array), onToggleRow(id,row), onToggleAll(rows).
 *   minWidth — px floor before the wrapper scrolls horizontally.
 *   density — 'default' | 'compact'.
 *
 * Mobile: this renders a desktop table. Pages that need a phone card layout wrap
 * DataTable in `hidden md:block` and render their card list separately (same as
 * today) — a shared card renderer can come later.
 */

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' };
const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

export default function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  rowClassName,
  loading = false,
  skeletonRows = 8,
  empty,
  emptyText,
  sortBy,
  sortDir = 'asc',
  onSort,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  minWidth = 640,
  density = 'default',
  className = '',
  dir,
}) {
  const { i18n } = useTranslation();
  const isRTL = dir ? dir === 'rtl' : i18n.language === 'ar';
  const cols = columns.filter(Boolean);

  const padY = density === 'compact' ? 'py-2' : 'py-3';
  const thBase = `text-[11px] text-[#6B8DB5] font-bold uppercase tracking-wider px-4 ${padY} bg-gray-50/80 dark:bg-brand-500/[0.06] border-b border-edge dark:border-edge-dark whitespace-nowrap`;
  // No overflow-hidden on the cell itself — text cells clip via their inner
  // `truncate` div, which keeps action menus / popovers in custom cells from
  // being clipped by the column box.
  const tdBase = `px-4 ${padY} text-sm text-content dark:text-content-dark border-b border-edge/50 dark:border-edge-dark/50`;

  const selectedSet = selectable ? (selectedIds instanceof Set ? selectedIds : new Set(selectedIds || [])) : null;
  const keyOf = (row, i) => {
    const k = typeof rowKey === 'function' ? rowKey(row) : row?.[rowKey];
    return k != null ? k : i;
  };
  const allChecked = selectable && rows.length > 0 && rows.every((r, i) => selectedSet.has(keyOf(r, i)));
  const totalCols = cols.length + (selectable ? 1 : 0);
  const widthStyle = (w) => (w == null ? undefined : { width: typeof w === 'number' ? `${w}px` : w });

  return (
    <div className="overflow-x-auto rounded-xl border border-edge dark:border-edge-dark">
      <table dir={isRTL ? 'rtl' : 'ltr'} className={`w-full table-fixed border-collapse ${className}`} style={{ minWidth }}>
        <thead>
          <tr>
            {selectable && (
              <th className={`${thBase} !px-2.5`} style={{ width: 40 }}>
                <input type="checkbox" checked={allChecked} onChange={() => onToggleAll?.(rows)} className="cursor-pointer" aria-label={isRTL ? 'تحديد الكل' : 'Select all'} />
              </th>
            )}
            {cols.map((col) => {
              const active = sortBy != null && sortBy === col.key;
              const sortable = col.sortable && onSort;
              return (
                <th
                  key={col.key}
                  style={widthStyle(col.width)}
                  className={`${thBase} ${ALIGN[col.align] || 'text-start'} ${col.hideBelow ? HIDE[col.hideBelow] : ''} ${col.headerClassName || ''} ${sortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={sortable ? () => onSort(col.key) : undefined}
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="inline-flex items-center gap-1 align-middle max-w-full">
                    <span className="truncate">{col.header}</span>
                    {sortable && active && (sortDir === 'asc' ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`sk-${r}`}>
                {selectable && <td className={tdBase} style={{ width: 40 }}><div className="h-3.5 w-4 rounded bg-black/5 dark:bg-white/10 animate-pulse" /></td>}
                {cols.map((col, ci) => (
                  <td key={col.key} className={`${tdBase} ${col.hideBelow ? HIDE[col.hideBelow] : ''}`}>
                    <div className="h-3.5 rounded bg-black/5 dark:bg-white/10 animate-pulse" style={{ width: `${45 + ((r + ci) % 5) * 11}%` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-12 text-center text-sm text-content-muted dark:text-content-muted-dark">
                {empty || emptyText || (isRTL ? 'لا توجد بيانات' : 'No data')}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const id = keyOf(row, i);
              const checked = selectable && selectedSet.has(id);
              const extra = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName;
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-surface-bg dark:hover:bg-brand-500/[0.04] transition-colors ${checked ? 'bg-brand-500/[0.06]' : ''} ${extra || ''}`}
                >
                  {selectable && (
                    <td className={`${tdBase} !px-2.5`} style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => onToggleRow?.(id, row)} className="cursor-pointer" aria-label={isRTL ? 'تحديد الصف' : 'Select row'} />
                    </td>
                  )}
                  {cols.map((col) => {
                    const content = col.render ? col.render(row, { isRTL }) : row[col.key];
                    const wrap = col.render ? col.truncate === true : col.truncate !== false;
                    const title = wrap && (typeof content === 'string' || typeof content === 'number') ? String(content) : undefined;
                    return (
                      <td
                        key={col.key}
                        style={widthStyle(col.width)}
                        className={`${tdBase} ${ALIGN[col.align] || 'text-start'} ${col.hideBelow ? HIDE[col.hideBelow] : ''} ${col.cellClassName || ''}`}
                        title={title}
                      >
                        {wrap ? <div className="truncate">{content}</div> : content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    header: PropTypes.node,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    align: PropTypes.oneOf(['start', 'center', 'end']),
    hideBelow: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
    render: PropTypes.func,
    truncate: PropTypes.bool,
    sortable: PropTypes.bool,
    headerClassName: PropTypes.string,
    cellClassName: PropTypes.string,
  })),
  rows: PropTypes.array,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  onRowClick: PropTypes.func,
  rowClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  loading: PropTypes.bool,
  skeletonRows: PropTypes.number,
  empty: PropTypes.node,
  emptyText: PropTypes.string,
  sortBy: PropTypes.string,
  sortDir: PropTypes.oneOf(['asc', 'desc']),
  onSort: PropTypes.func,
  selectable: PropTypes.bool,
  selectedIds: PropTypes.oneOfType([PropTypes.instanceOf(Set), PropTypes.array]),
  onToggleRow: PropTypes.func,
  onToggleAll: PropTypes.func,
  minWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  density: PropTypes.oneOf(['default', 'compact']),
  className: PropTypes.string,
  dir: PropTypes.oneOf(['rtl', 'ltr']),
};
