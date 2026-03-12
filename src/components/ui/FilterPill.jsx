export default function FilterPill({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors
        ${active
          ? 'bg-brand-500 text-white border-brand-500 font-semibold'
          : 'bg-surface-card dark:bg-surface-card-dark border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}
      `}
    >
      {label}
      {count != null && (
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none
          ${active ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-500'}
        `}>
          {count}
        </span>
      )}
    </button>
  );
}
