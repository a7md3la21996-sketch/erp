import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Shared CRM-style KPI/metric card. Mirrors the card used on the CRM dashboard:
// label + icon chip on top, a big tabular number, an optional sublabel, and an
// optional delta badge. `color` accepts a named token (brand/red/emerald/amber/
// purple) OR any hex string — hex falls back to inline styling so callers that
// carry a category colour (e.g. Reports) render on the same card without a new
// component. Pass `to` to make the whole card a router link.
const NAMED = {
  brand: 'text-brand-500 bg-brand-500/10 border-brand-500/20',
  red: 'text-red-500 bg-red-500/10 border-red-500/20',
  emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
};

export default function MetricCard({ label, value, sublabel, icon: Icon, color = 'brand', to, delta, description, hero = false }) {
  const isNamed = typeof color === 'string' && NAMED[color];
  const DeltaIcon = delta?.direction === 'up' ? ArrowUp : delta?.direction === 'down' ? ArrowDown : Minus;
  const deltaToneClass = delta?.tone === 'pos'
    ? 'text-emerald-500'
    : delta?.tone === 'neg'
      ? 'text-red-500'
      : 'text-content-muted dark:text-content-muted-dark';
  const safeVal = (v) => (v != null && typeof v === 'object') ? String(v) : (typeof v === 'number' ? v.toLocaleString() : v);

  const content = (
    <div title={description} className="h-full bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand-500/30 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-content-muted dark:text-content-muted-dark font-medium truncate">{label}</span>
        <span
          className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${isNamed ? NAMED[color] : ''}`}
          style={isNamed ? undefined : { color, background: `${color}1A`, borderColor: `${color}33` }}
        >
          {Icon && <Icon size={15} />}
        </span>
      </div>
      <div className={`font-bold text-content dark:text-content-dark leading-none tracking-tight tabular-nums ${hero ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{safeVal(value)}</div>
      {sublabel && <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1.5 truncate">{sublabel}</div>}
      {delta && (
        <div className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 ${deltaToneClass}`}>
          <DeltaIcon size={12} /> {delta.label}
        </div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block no-underline h-full">{content}</Link> : content;
}
