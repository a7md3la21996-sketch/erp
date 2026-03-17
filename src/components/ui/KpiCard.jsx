import { useState } from 'react';

export default function KpiCard({ icon: Icon, label, value, sub, color = '#4A7AAB', onClick, className: extraClass = '' }) {
  // Safety: ensure value/label/sub are never objects (React error #310)
  const safeVal = (v) => (v != null && typeof v === 'object') ? JSON.stringify(v) : v;
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark transition-all duration-200 ${extraClass}`}
      style={{
        borderColor: hov ? `${color}60` : undefined,
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 8px 24px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Side accent bar */}
      <div
        className="absolute top-0 end-0 w-1 h-full rounded-s-xl transition-opacity duration-200"
        style={{ background: `linear-gradient(180deg,${color},transparent)`, opacity: hov ? 1 : 0.6 }}
      />

      <div className="flex items-start justify-between px-3 sm:px-5 py-3 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-1 sm:mb-1.5 text-[10px] sm:text-xs font-medium text-content-muted dark:text-content-muted-dark truncate">{safeVal(label)}</p>
          <p className="m-0 text-lg sm:text-2xl font-extrabold leading-none text-content dark:text-content-dark">{safeVal(value)}</p>
          {sub && <p className="m-0 mt-1 text-[10px] sm:text-[11px] text-content-muted dark:text-content-muted-dark truncate">{safeVal(sub)}</p>}
        </div>
        <div
          className="flex items-center justify-center w-8 h-8 sm:w-[42px] sm:h-[42px] rounded-lg sm:rounded-[11px] transition-colors duration-200 shrink-0 ms-2"
          style={{ background: `${color}${hov ? '25' : '15'}` }}
        >
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  );
}
