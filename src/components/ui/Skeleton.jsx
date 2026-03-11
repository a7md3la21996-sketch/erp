const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, className = '' }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div
        className={`bg-[linear-gradient(90deg,#f0f0f0_25%,#e0e0e0_50%,#f0f0f0_75%)] dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.04)_75%)] ${className}`}
        style={{
          width, height, borderRadius,
          backgroundSize: '800px 100%',
          animation: 'shimmer 1.5s infinite linear',
        }}
      />
    </>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <div className="flex gap-3 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={14} className={i === 0 ? 'flex-[2]' : 'flex-1'} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="px-1">
      <div className="flex gap-3 py-3 mb-1">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="60%" className={i === 0 ? 'flex-[2]' : 'flex-1'} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-[18px] rounded-xl">
          <Skeleton width="40%" height={12} className="mb-2.5" />
          <Skeleton width="60%" height={28} className="mb-2" />
          <Skeleton width="50%" height={10} />
        </div>
      ))}
    </div>
  );
}
