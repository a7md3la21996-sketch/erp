import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2 } from 'lucide-react';
import { searchContacts } from '../../../services/opportunitiesService';
import { initials, avatarColor } from './constants';
import { Input } from '../../../components/ui';

export default function ContactSearch({ isRTL, value, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const data = await searchContacts(q);
    setResults(data);
    setSearching(false);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-sm font-cairo flex items-center justify-between">
          <span>{value.full_name} {value.phone ? `(${value.phone})` : ''}</span>
          <button
            onClick={() => { onSelect(null); setQuery(''); }}
            className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={isRTL ? 'ابحث عن جهة اتصال...' : 'Search contacts...'}
        />
      )}
      {open && !value && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-[60] max-h-[200px] overflow-y-auto">
          {searching ? (
            <div className="p-4 text-center text-content-muted dark:text-content-muted-dark text-xs">
              <Loader2 size={16} className="animate-spin inline-block" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-content-muted dark:text-content-muted-dark text-xs">
              {isRTL ? 'لا توجد نتائج' : 'No results'}
            </div>
          ) : (
            results.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); setOpen(false); setQuery(''); }}
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none cursor-pointer text-sm text-content dark:text-content-dark font-cairo hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: avatarColor(c.id) }}
                >
                  {initials(c.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.full_name}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark" dir="ltr">
                    {c.phone || c.email || ''}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
