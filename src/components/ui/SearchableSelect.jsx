import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * SearchableSelect — a native-<select> replacement with a type-to-filter box.
 * Use it ONLY for long option lists (agents, sources…); short lists are better
 * as a plain <select>.
 *
 * Props: value, onChange(value), options:[{value,label}], placeholder,
 *   className (trigger classes), activeColor (border/text when a value is set),
 *   disabled.
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder, className, activeColor, disabled, searchThreshold = 8 }) {
  const { i18n } = useTranslation();
  const isRTL = (i18n.language || 'ar').startsWith('ar');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => { if (open) { setQ(''); const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); } }, [open]);

  const current = options.find(o => o.value === value);
  // Only show the search box for long lists — on a short list it's friction,
  // not help. So the SAME component can be used everywhere for one consistent
  // look, and the search simply appears when it's actually useful.
  const showSearch = options.length > searchThreshold;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (showSearch && s) ? options.filter(o => String(o.label).toLowerCase().includes(s)) : options;
  }, [q, options, showSearch]);

  const triggerCls = className || 'px-3 py-1.5 rounded-lg text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark';

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 cursor-pointer ${triggerCls}`}
        style={activeColor ? { borderColor: activeColor, color: activeColor } : undefined}>
        <span className="truncate max-w-[150px] text-start">{current ? current.label : (placeholder || '')}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[3000]" onClick={() => setOpen(false)} />
          {/* Mobile: dock as a bottom sheet so it can never overflow off-screen
              regardless of where the trigger sits. Desktop (sm+): a normal
              popover anchored to the trigger. */}
          <div dir={isRTL ? 'rtl' : 'ltr'}
            className="fixed sm:absolute inset-x-2 sm:inset-auto bottom-2 sm:bottom-auto top-auto sm:top-full sm:mt-1 sm:end-0 z-[3001] w-auto sm:w-[230px] sm:max-w-[calc(100vw-1rem)] max-h-[70vh] sm:max-h-none flex flex-col bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-[0_8px_30px_rgba(27,51,71,0.15)] overflow-hidden">
            {showSearch && (
              <div className="p-1.5 border-b border-edge/60 dark:border-edge-dark/60 shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark pointer-events-none" />
                  <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} dir="auto"
                    placeholder={isRTL ? 'بحث...' : 'Search...'}
                    className="w-full pe-7 ps-2.5 py-1.5 rounded-lg text-xs bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark outline-none focus:border-brand-500" />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto py-1 sm:max-h-[240px]">
              {filtered.length === 0 && <div className="px-3 py-2 text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا نتائج' : 'No matches'}</div>}
              {filtered.map(o => {
                const active = o.value === value;
                return (
                  <button key={String(o.value)} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full text-start px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 border-none bg-transparent ${active ? 'bg-brand-500/10 text-brand-500 font-semibold' : 'text-content dark:text-content-dark hover:bg-brand-500/[0.07]'}`}>
                    <span className="flex-1 truncate">{o.label}</span>
                    {active && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
