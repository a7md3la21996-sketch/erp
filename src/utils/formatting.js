/**
 * Format money values to short form (e.g., 2.5M, 350K)
 */
export const fmtMoney = (v) =>
  v >= 1000000
    ? (v / 1000000).toFixed(1) + 'M'
    : v >= 1000
      ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'K'
      : String(v || 0);

/**
 * Format number with locale separators (e.g., 1,234,567)
 */
export const fmtFull = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
