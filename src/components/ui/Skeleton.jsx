import { useTheme } from '../../contexts/ThemeContext';

const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <>
      <style>{shimmerStyle}</style>
      <div style={{
        width, height, borderRadius,
        background: isDark
          ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)'
          : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '800px 100%',
        animation: 'shimmer 1.5s infinite linear',
        ...style,
      }} />
    </>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={14} style={{ flex: i === 0 ? 2 : 1 }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', gap: 12, padding: '12px 0', marginBottom: 4 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="60%" style={{ flex: i === 0 ? 2 : 1 }} />
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
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)`, gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: 18, borderRadius: 14 }}>
          <Skeleton width="40%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
          <Skeleton width="50%" height={10} />
        </div>
      ))}
    </div>
  );
}
