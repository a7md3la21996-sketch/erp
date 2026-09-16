import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * SearchableSelect — a native-<select> replacement with an optional type-to-filter
 * box (auto-shown only for long lists). The panel is rendered in a PORTAL to
 * <body> with fixed positioning computed from the trigger, so it floats ABOVE
 * everything and is never clipped by a scrollable/overflow container. On mobile
 * it docks as a bottom sheet.
 *
 * Props: value, onChange(value), options:[{value,label}], placeholder,
 *   className (trigger classes), activeColor (border/text when a value is set),
 *   disabled, searchThreshold (default 8 — show the search box above this many).
 */
export default function SearchableSelect({ value, onChange, options = [], placeholder, className, activeColor, disabled, searchThreshold = 8 }) {
  const { i18n } = useTranslation();
  const isRTL = (i18n.language || 'ar').startsWith('ar');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(null);   // {left,width,maxH,top?|bottom?} or {mobile:true}
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const showSearch = options.length > searchThreshold;
  const current = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (showSearch && s) ? options.filter(o => String(o.label).toLowerCase().includes(s)) : options;
  }, [q, options, showSearch]);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 640) { setPos({ mobile: true }); return; } // bottom sheet
    const W = Math.min(240, vw - 16);
    let left = isRTL ? (r.right - W) : r.left;
    left = Math.max(8, Math.min(left, vw - W - 8));
    const below = vh - r.bottom - 12, above = r.top - 12;
    const up = below < 200 && above > below;
    setPos({ left, width: W, maxH: Math.min(340, up ? above : below), ...(up ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 }) });
  };

  const openMenu = () => { if (disabled) return; place(); setOpen(true); };
  const toggle = () => (open ? setOpen(false) : openMenu());

  // Outside-click (trigger toggles itself; panel is portaled so check it too) +
  // close on scroll/resize (a fixed panel can't follow the trigger).
  useEffect(() => {
    if (!open) return;
    // preventScroll: the search input lives in a portal at the END of <body>,
    // so a default focus would scroll the document down to that DOM position
    // (i.e. jump the page to the bottom). preventScroll keeps the page put.
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    // Close when the PAGE/container scrolls (a fixed panel can't follow the
    // trigger) — but NOT when scrolling inside the panel's own list.
    const onScroll = (e) => { if (panelRef.current && panelRef.current.contains(e.target)) return; setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
  }, [open]);

  const triggerCls = className || 'px-3 py-1.5 rounded-lg text-xs bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark';
  const mobile = pos?.mobile;

  const panel = (
    <div ref={panelRef} dir={isRTL ? 'rtl' : 'ltr'}
      className={`fixed z-[3001] flex flex-col bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-[0_8px_30px_rgba(27,51,71,0.18)] overflow-hidden ${mobile ? 'inset-x-2 bottom-2 max-h-[70vh]' : ''}`}
      style={mobile ? undefined : { top: pos?.top, bottom: pos?.bottom, left: pos?.left, width: pos?.width, maxHeight: pos?.maxH }}>
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
      <div className="flex-1 overflow-y-auto py-1">
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
  );

  return (
    <div className="relative inline-block">
      <button ref={btnRef} type="button" disabled={disabled} onClick={toggle}
        className={`inline-flex items-center gap-1.5 cursor-pointer ${triggerCls}`}
        style={activeColor ? { borderColor: activeColor, color: activeColor } : undefined}>
        <span className="flex-1 min-w-0 truncate text-start">{current ? current.label : (placeholder || '')}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
      {open && pos && createPortal(panel, document.body)}
    </div>
  );
}
