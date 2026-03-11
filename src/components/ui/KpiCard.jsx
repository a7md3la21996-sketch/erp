import { useState } from 'react';

export default function KpiCard({ icon: Icon, label, value, sub, color = '#4A7AAB' }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative overflow-hidden rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark transition-all duration-200"
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

      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <p className="m-0 mb-1.5 text-xs font-medium text-content-muted dark:text-content-muted-dark">{label}</p>
          <p className="m-0 text-2xl font-extrabold leading-none text-content dark:text-content-dark">{value}</p>
          {sub && <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">{sub}</p>}
        </div>
        <div
          className="flex items-center justify-center w-[42px] h-[42px] rounded-[11px] transition-colors duration-200"
          style={{ background: `${color}${hov ? '25' : '15'}` }}
        >
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}
