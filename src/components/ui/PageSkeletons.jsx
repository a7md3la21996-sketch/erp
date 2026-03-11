// PageSkeletons.jsx — Unified loading skeleton components for all pages

const shimmerStyle = `
@keyframes sk-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

function ShimmerBar({ className = '', style = {} }) {
  return (
    <div
      className={`rounded-md bg-[linear-gradient(90deg,#e5e7eb_25%,#d1d5db_50%,#e5e7eb_75%)] dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.10)_50%,rgba(255,255,255,0.05)_75%)] ${className}`}
      style={{ backgroundSize: '800px 100%', animation: 'sk-shimmer 1.5s infinite linear', ...style }}
    />
  );
}

// ── Table Skeleton ──────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
      <style>{shimmerStyle}</style>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.02]">
        {Array.from({ length: cols }).map((_, i) => (
          <ShimmerBar key={i} className={i === 0 ? 'flex-[2]' : 'flex-1'} style={{ height: 10, width: '50%' }} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-gray-100 dark:border-white/[0.04] last:border-b-0 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <ShimmerBar
              key={c}
              className={c === 0 ? 'flex-[2]' : 'flex-1'}
              style={{ height: 12, width: c === 0 ? '70%' : `${50 + ((r + c) % 3) * 15}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── KPI Skeleton ────────────────────────────────────────────────────────────
export function KpiSkeleton({ count = 4 }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4" style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)` }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 flex flex-col gap-3 bg-white dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <ShimmerBar style={{ height: 10, width: '45%' }} />
              <div className="w-9 h-9 rounded-[10px] bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            <ShimmerBar style={{ height: 24, width: '55%' }} />
            <ShimmerBar style={{ height: 8, width: '40%' }} className="opacity-60" />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Dashboard Skeleton ──────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <style>{shimmerStyle}</style>

      {/* Header greeting */}
      <div className="flex flex-col gap-2">
        <ShimmerBar style={{ height: 20, width: 220 }} />
        <ShimmerBar style={{ height: 12, width: 160 }} className="opacity-60" />
      </div>

      {/* KPI row */}
      <KpiSkeleton count={4} />

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 bg-white dark:bg-white/[0.02]">
            <ShimmerBar style={{ height: 12, width: '30%' }} className="mb-4" />
            <div className="h-[180px] rounded-lg bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-white/[0.08] p-5 bg-white dark:bg-white/[0.02]">
            <ShimmerBar style={{ height: 12, width: '40%' }} className="mb-4" />
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <ShimmerBar style={{ height: 10, width: '60%' }} />
                    <ShimmerBar style={{ height: 8, width: '40%' }} className="opacity-60" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── List Skeleton ───────────────────────────────────────────────────────────
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
      <style>{shimmerStyle}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-white/[0.04] last:border-b-0">
          <div className="w-10 h-10 rounded-[10px] bg-gray-100 dark:bg-white/[0.06] animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <ShimmerBar style={{ height: 12, width: `${40 + (i % 3) * 10}%` }} />
            <ShimmerBar style={{ height: 9, width: `${55 + (i % 2) * 15}%` }} className="opacity-60" />
          </div>
          <ShimmerBar className="shrink-0" style={{ height: 24, width: 60, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  );
}

// ── Form Skeleton ───────────────────────────────────────────────────────────
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <style>{shimmerStyle}</style>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <ShimmerBar style={{ height: 10, width: 80 }} />
          <ShimmerBar style={{ height: 38, width: '100%', borderRadius: 8 }} className="opacity-80" />
        </div>
      ))}
      {/* Action buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <ShimmerBar style={{ height: 36, width: 90, borderRadius: 8 }} />
        <ShimmerBar style={{ height: 36, width: 110, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ── Page Skeleton — combines header + filters + table/list ──────────────────
export function PageSkeleton({ hasKpis = false, kpiCount = 4, tableRows = 6, tableCols = 5, variant = 'table' }) {
  return (
    <div className="p-6 flex flex-col gap-5">
      <style>{shimmerStyle}</style>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <ShimmerBar style={{ height: 18, width: 160 }} />
          <ShimmerBar style={{ height: 10, width: 100 }} className="opacity-50" />
        </div>
        <ShimmerBar style={{ height: 36, width: 120, borderRadius: 8 }} />
      </div>

      {/* KPI cards */}
      {hasKpis && <KpiSkeleton count={kpiCount} />}

      {/* Filter bar */}
      <div className="flex gap-3 items-center">
        <ShimmerBar style={{ height: 36, width: 220, borderRadius: 8 }} />
        <ShimmerBar style={{ height: 36, width: 120, borderRadius: 8 }} />
        <ShimmerBar style={{ height: 36, width: 120, borderRadius: 8 }} />
      </div>

      {/* Content area */}
      {variant === 'table' ? (
        <TableSkeleton rows={tableRows} cols={tableCols} />
      ) : (
        <ListSkeleton rows={tableRows} />
      )}
    </div>
  );
}
