/**
 * Shared table styling classes used across all pages
 */
export const thCls = 'text-[11px] text-[#6B8DB5] font-bold uppercase tracking-wider px-4 py-3 bg-gray-50/80 dark:bg-brand-500/[0.06] border-b border-edge dark:border-edge-dark whitespace-nowrap text-start';

export const tdCls = 'px-4 py-3 text-sm text-content dark:text-content-dark border-b border-edge/50 dark:border-edge-dark/50';

/**
 * Stable-layout table pattern — content NEVER resizes columns.
 *
 * Why: a default (auto-layout) table sizes each column to its content, so one
 * long value widens that column and shifts every other one — the table "jumps"
 * as data changes. `table-fixed` locks column widths instead; overflowing text
 * is clipped with an ellipsis.
 *
 * How to use (keep all three together or columns collapse):
 *   1. <table className={tableFixedCls}> (optionally add `min-w-[NNNpx]` so it
 *      scrolls horizontally rather than crushing columns on small screens).
 *   2. Give EVERY <th> an explicit width (`w-[140px]`, `w-9`, …). A column left
 *      width-less gets zero leftover space under table-fixed and collapses —
 *      that is the one gotcha. Pick ONE primary column to be the widest.
 *   3. Wrap any free-text cell value in `cellText` (or add `truncate` yourself)
 *      so long values ellipsize inside the fixed column, with a `title` for hover.
 */
export const tableFixedCls = 'w-full table-fixed border-collapse';

// Free-text cell content: clip to the column width with a trailing ellipsis.
export const cellText = 'block truncate';
