import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, X, Filter, RotateCcw, Zap, Check, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * SmartFilter – Odoo/Notion-style dynamic filter bar
 *
 * Props:
 *   fields: [{ id, label, labelEn, type: 'select'|'text'|'date'|'number', options?: [{value,label,labelEn}] }]
 *   filters: [{field, operator, value, logic?:'and'|'or'}]  — controlled state (value can be string or string[])
 *   onFiltersChange: (filters) => void
 *   search: string                                 — controlled search
 *   onSearchChange: (val) => void
 *   searchPlaceholder?: string
 *   sortOptions?: [{value,label,labelEn}]
 *   sortBy?: string
 *   onSortChange?: (val) => void
 *   quickFilters?: [{label, labelEn, icon?, filters: [{field,operator,value}]}]
 *   extraActions?: ReactNode
 *   resultsCount?: number
 */

const OPERATORS = {
  select: [
    { id: 'is', ar: 'يساوي', en: 'is' },
    { id: 'is_not', ar: 'لا يساوي', en: 'is not' },
    { id: 'in', ar: 'أي من', en: 'is any of' },
    { id: 'not_in', ar: 'ليس أي من', en: 'is none of' },
  ],
  text: [
    { id: 'contains', ar: 'يحتوي', en: 'contains' },
    { id: 'not_contains', ar: 'لا يحتوي', en: 'does not contain' },
    { id: 'is', ar: 'يساوي', en: 'is' },
  ],
  date: [
    { id: 'is', ar: 'يساوي', en: 'is' },
    { id: 'before', ar: 'قبل', en: 'before' },
    { id: 'after', ar: 'بعد', en: 'after' },
    { id: 'last_7', ar: 'آخر ٧ أيام', en: 'last 7 days' },
    { id: 'last_30', ar: 'آخر ٣٠ يوم', en: 'last 30 days' },
    { id: 'this_month', ar: 'هذا الشهر', en: 'this month' },
    { id: 'this_week', ar: 'هذا الأسبوع', en: 'this week' },
  ],
  number: [
    { id: 'eq', ar: 'يساوي', en: '=' },
    { id: 'gt', ar: 'أكبر من', en: '>' },
    { id: 'lt', ar: 'أصغر من', en: '<' },
    { id: 'gte', ar: 'أكبر أو يساوي', en: '>=' },
    { id: 'lte', ar: 'أصغر أو يساوي', en: '<=' },
  ],
};

const NO_VALUE_OPS = ['last_7', 'last_30', 'this_month', 'this_week'];
const MULTI_OPS = ['in', 'not_in'];

export default function SmartFilter({
  fields = [],
  filters = [],
  onFiltersChange,
  search = '',
  onSearchChange,
  searchPlaceholder,
  sortOptions,
  sortBy,
  onSortChange,
  quickFilters = [],
  extraActions,
  resultsCount,
}) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [showAddRow, setShowAddRow] = useState(false);
  const [draft, setDraft] = useState({ field: '', operator: '', value: '' });
  const [draftMulti, setDraftMulti] = useState([]);
  const [sortOpen, setSortOpen] = useState(false);
  const popRef = useRef(null);
  const sortRef = useRef(null);

  useEffect(() => {
    if (!showAddRow) return;
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setShowAddRow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddRow]);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const getField = (id) => fields.find(f => f.id === id);
  const getFieldType = (id) => getField(id)?.type || 'text';
  const operators = getFieldType(draft.field) ? OPERATORS[getFieldType(draft.field)] : [];

  const handleFieldChange = (fid) => {
    const type = fields.find(f => f.id === fid)?.type || 'text';
    const ops = OPERATORS[type];
    setDraft({ field: fid, operator: ops?.[0]?.id || '', value: '' });
    setDraftMulti([]);
  };

  const handleOperatorChange = (opId) => {
    setDraft(d => ({ ...d, operator: opId, value: '' }));
    setDraftMulti([]);
  };

  const toggleMultiValue = (val) => {
    setDraftMulti(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const addFilter = () => {
    if (!draft.field || !draft.operator) return;
    const isMulti = MULTI_OPS.includes(draft.operator);
    // Default logic: first filter has no logic connector, subsequent ones get 'and'
    const logic = filters.length === 0 ? undefined : 'and';
    if (isMulti) {
      if (draftMulti.length === 0) return;
      onFiltersChange([...filters, { field: draft.field, operator: draft.operator, value: draftMulti, logic }]);
    } else {
      if (!NO_VALUE_OPS.includes(draft.operator) && !draft.value) return;
      onFiltersChange([...filters, { ...draft, logic }]);
    }
    setDraft({ field: '', operator: '', value: '' });
    setDraftMulti([]);
  };

  const removeFilter = (idx) => {
    const next = filters.filter((_, i) => i !== idx);
    // Reset first filter's logic to undefined
    if (next.length > 0 && next[0].logic) {
      next[0] = { ...next[0], logic: undefined };
    }
    onFiltersChange(next);
  };

  const toggleFilterLogic = (idx) => {
    if (idx === 0) return; // first filter has no logic
    const next = [...filters];
    next[idx] = { ...next[idx], logic: next[idx].logic === 'or' ? 'and' : 'or' };
    onFiltersChange(next);
  };

  const resetAll = () => {
    onFiltersChange([]);
    onSearchChange?.('');
    onSortChange?.(sortOptions?.[0]?.value);
  };

  const applyQuickFilter = (qf) => {
    const isActive = isQuickFilterActive(qf);
    if (isActive) {
      const qfKeys = qf.filters.map(f => `${f.field}:${f.operator}:${JSON.stringify(f.value)}`);
      onFiltersChange(filters.filter(f => !qfKeys.includes(`${f.field}:${f.operator}:${JSON.stringify(f.value)}`)));
    } else {
      const newFilters = qf.filters.map((f, i) => ({
        ...f,
        logic: (filters.length === 0 && i === 0) ? undefined : 'and',
      }));
      onFiltersChange([...filters, ...newFilters]);
    }
  };

  const isQuickFilterActive = (qf) => {
    return qf.filters.every(qff =>
      filters.some(f => f.field === qff.field && f.operator === qff.operator && JSON.stringify(f.value) === JSON.stringify(qff.value))
    );
  };

  const getChipLabel = useCallback((f) => {
    const field = getField(f.field);
    const fLabel = isRTL ? field?.label : (field?.labelEn || field?.label);
    const opObj = OPERATORS[field?.type || 'text']?.find(o => o.id === f.operator);
    const opLabel = isRTL ? opObj?.ar : opObj?.en;

    if (NO_VALUE_OPS.includes(f.operator)) return `${fLabel} ${opLabel}`;

    if (Array.isArray(f.value)) {
      const labels = f.value.map(v => {
        if (field?.type === 'select' && field.options) {
          const opt = field.options.find(o => o.value === v);
          return isRTL ? (opt?.label || v) : (opt?.labelEn || opt?.label || v);
        }
        return v;
      });
      return `${fLabel} ${opLabel} [${labels.join(', ')}]`;
    }

    let valLabel = f.value;
    if (field?.type === 'select' && field.options) {
      const opt = field.options.find(o => o.value === f.value);
      valLabel = isRTL ? (opt?.label || f.value) : (opt?.labelEn || opt?.label || f.value);
    }
    return `${fLabel} ${opLabel} "${valLabel}"`;
  }, [fields, isRTL]);

  const hasActiveFilters = filters.length > 0 || (search && search.length > 0);

  const inputCls = 'rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs px-2.5 py-1.5 font-cairo outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30';

  return (
    <div className="mb-4">
      {/* Main bar */}
      <div className="flex gap-2 items-center flex-wrap bg-gray-50 dark:bg-brand-500/[0.08] px-3.5 py-2.5 rounded-xl border border-edge dark:border-edge-dark">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-[1_1_180px] max-w-[320px]">
            <Search size={14} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#6B8DB5] pointer-events-none" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || (isRTL ? 'بحث...' : 'Search...')}
              className={`${inputCls} w-full pe-8`}
            />
          </div>
        )}

        {/* Add Filter button */}
        <div className="relative" ref={popRef}>
          <button
            onClick={() => setShowAddRow(!showAddRow)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              showAddRow
                ? 'border-brand-500 bg-brand-500/10 text-brand-500 font-semibold'
                : 'border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'
            }`}
          >
            <Filter size={13} />
            {isRTL ? 'فلتر' : 'Filter'}
            {filters.length > 0 && (
              <span className="bg-brand-500 text-white text-[10px] px-1.5 py-px rounded-full font-bold leading-none">
                {filters.length}
              </span>
            )}
          </button>

          {/* Popover */}
          {showAddRow && (
            <div
              className="absolute top-[36px] start-0 z-[200] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-[0_8px_30px_rgba(27,51,71,0.15)] p-3 min-w-[380px] max-w-[440px]"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-xs font-semibold text-content dark:text-content-dark">
                  {isRTL ? 'إضافة فلتر' : 'Add Filter'}
                </div>
                {filters.length > 0 && (
                  <button onClick={() => onFiltersChange([])} className="text-[11px] text-red-500 bg-transparent border-none cursor-pointer hover:underline p-0 flex items-center gap-1">
                    <RotateCcw size={10} /> {isRTL ? 'مسح الكل' : 'Clear all'}
                  </button>
                )}
              </div>

              {/* Existing filters with AND/OR toggles */}
              {filters.length > 0 && (
                <div className="space-y-1 mb-3">
                  {filters.map((f, i) => (
                    <div key={i}>
                      {/* AND/OR toggle between filters */}
                      {i > 0 && (
                        <div className="flex items-center gap-2 py-0.5 px-1">
                          <button
                            onClick={() => toggleFilterLogic(i)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer transition-colors"
                            style={{
                              color: f.logic === 'or' ? '#F59E0B' : '#4A7AAB',
                              borderColor: f.logic === 'or' ? '#F59E0B40' : '#4A7AAB40',
                              background: f.logic === 'or' ? '#F59E0B10' : '#4A7AAB10',
                            }}
                          >
                            {f.logic === 'or' ? (isRTL ? 'أو' : 'OR') : (isRTL ? 'و' : 'AND')}
                          </button>
                          <div className="flex-1 h-px bg-edge dark:bg-edge-dark" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-brand-500/[0.05] rounded-lg px-2.5 py-1.5">
                        <span className="text-[11px] text-content dark:text-content-dark flex-1 truncate">{getChipLabel(f)}</span>
                        <button onClick={() => removeFilter(i)} className="text-content-muted dark:text-content-muted-dark hover:text-red-500 cursor-pointer bg-transparent border-none p-0 shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New filter row */}
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[100px]">
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الحقل' : 'Field'}</div>
                  <select value={draft.field} onChange={e => handleFieldChange(e.target.value)} className={`${inputCls} w-full`}>
                    <option value="">{isRTL ? 'اختر...' : 'Choose...'}</option>
                    {fields.map(f => <option key={f.id} value={f.id}>{isRTL ? f.label : (f.labelEn || f.label)}</option>)}
                  </select>
                </div>

                {draft.field && (
                  <div className="flex-1 min-w-[90px]">
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الشرط' : 'Condition'}</div>
                    <select value={draft.operator} onChange={e => handleOperatorChange(e.target.value)} className={`${inputCls} w-full`}>
                      {operators.map(op => <option key={op.id} value={op.id}>{isRTL ? op.ar : op.en}</option>)}
                    </select>
                  </div>
                )}

                {/* Value — single */}
                {draft.field && draft.operator && !NO_VALUE_OPS.includes(draft.operator) && !MULTI_OPS.includes(draft.operator) && (
                  <div className="flex-1 min-w-[100px]">
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'القيمة' : 'Value'}</div>
                    {getFieldType(draft.field) === 'select' ? (
                      <select value={draft.value} onChange={e => setDraft(d => ({ ...d, value: e.target.value }))} className={`${inputCls} w-full`}>
                        <option value="">{isRTL ? 'اختر...' : 'Choose...'}</option>
                        {getField(draft.field)?.options?.map(o => <option key={o.value} value={o.value}>{isRTL ? o.label : (o.labelEn || o.label)}</option>)}
                      </select>
                    ) : getFieldType(draft.field) === 'date' ? (
                      <input type="date" value={draft.value} onChange={e => setDraft(d => ({ ...d, value: e.target.value }))} className={`${inputCls} w-full`} />
                    ) : getFieldType(draft.field) === 'number' ? (
                      <input type="number" value={draft.value} onChange={e => setDraft(d => ({ ...d, value: e.target.value }))} className={`${inputCls} w-full`} />
                    ) : (
                      <input type="text" value={draft.value} onChange={e => setDraft(d => ({ ...d, value: e.target.value }))} className={`${inputCls} w-full`}
                        onKeyDown={e => e.key === 'Enter' && addFilter()} />
                    )}
                  </div>
                )}

                {/* Add button (single value) */}
                {draft.field && draft.operator && !MULTI_OPS.includes(draft.operator) && (
                  <button
                    onClick={addFilter}
                    disabled={!NO_VALUE_OPS.includes(draft.operator) && !draft.value}
                    className="h-[30px] px-3 rounded-lg bg-brand-500 text-white text-xs font-semibold border-none cursor-pointer hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Plus size={12} /> {isRTL ? 'أضف' : 'Add'}
                  </button>
                )}
              </div>

              {/* Multi-select value picker */}
              {draft.field && draft.operator && MULTI_OPS.includes(draft.operator) && getFieldType(draft.field) === 'select' && (
                <div className="mt-2.5">
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1.5">
                    {isRTL ? `اختر القيم (${draftMulti.length} مختار)` : `Select values (${draftMulti.length} selected)`}
                  </div>
                  <div className="flex gap-1.5 flex-wrap max-h-[140px] overflow-y-auto p-1">
                    {getField(draft.field)?.options?.map(o => {
                      const selected = draftMulti.includes(o.value);
                      return (
                        <button
                          key={o.value}
                          onClick={() => toggleMultiValue(o.value)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                            selected
                              ? 'border-brand-500 bg-brand-500/10 text-brand-500 font-semibold'
                              : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'
                          }`}
                        >
                          {selected && <Check size={10} />}
                          {isRTL ? o.label : (o.labelEn || o.label)}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={addFilter}
                    disabled={draftMulti.length === 0}
                    className="mt-2 h-[30px] px-3 rounded-lg bg-brand-500 text-white text-xs font-semibold border-none cursor-pointer hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Plus size={12} /> {isRTL ? 'أضف' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        {quickFilters.length > 0 && (
          <div className="flex gap-1.5 items-center">
            <Zap size={12} className="text-[#6B8DB5] shrink-0" />
            {quickFilters.map((qf, i) => {
              const active = isQuickFilterActive(qf);
              return (
                <button
                  key={i}
                  onClick={() => applyQuickFilter(qf)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                    active
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500 font-semibold'
                      : 'border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark hover:border-brand-500/30'
                  }`}
                >
                  {isRTL ? qf.label : (qf.labelEn || qf.label)}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort — dropdown button */}
        {sortOptions && onSortChange && (
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(prev => !prev)}
              title={sortOptions.find(s => s.value === sortBy)?.[isRTL ? 'label' : 'labelEn'] || sortOptions.find(s => s.value === sortBy)?.label || ''}
              className={`${inputCls} px-2 cursor-pointer flex items-center justify-center`}
            >
              <ArrowUpDown size={14} />
            </button>
            {sortOpen && (
              <div
                className="absolute top-full mt-1 end-0 z-50 min-w-[160px] max-w-[calc(100vw-2rem)] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg py-1 overflow-hidden"
              >
                {sortOptions.map(opt => {
                  const isActive = opt.value === sortBy;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                      className={`w-full text-start px-3 py-2 text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-brand-500/10 text-brand-500 font-semibold'
                          : 'text-content dark:text-content-dark hover:bg-brand-500/10'
                      }`}
                    >
                      {isRTL ? opt.label : (opt.labelEn || opt.label)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {extraActions}

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/[0.06] text-red-500 text-xs cursor-pointer hover:bg-red-500/[0.12] transition-colors"
            title={isRTL ? 'إعادة تعيين' : 'Reset all'}
          >
            <RotateCcw size={12} />
            {isRTL ? 'مسح' : 'Reset'}
          </button>
        )}

        {/* Results count */}
        {resultsCount != null && (
          <span className="text-xs text-content-muted dark:text-content-muted-dark ms-auto whitespace-nowrap">
            {resultsCount} {isRTL ? 'نتيجة' : (resultsCount === 1 ? 'result' : 'results')}
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {filters.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2 px-1 items-center">
          {filters.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-1">
              {i > 0 && (
                <button
                  onClick={() => toggleFilterLogic(i)}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer border-none"
                  style={{
                    color: f.logic === 'or' ? '#F59E0B' : '#6B8DB5',
                    background: f.logic === 'or' ? '#F59E0B12' : 'transparent',
                  }}
                >
                  {f.logic === 'or' ? (isRTL ? 'أو' : 'OR') : (isRTL ? 'و' : 'AND')}
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-brand-500/[0.08] border border-brand-500/20 text-brand-700 dark:text-brand-300 font-medium">
                {getChipLabel(f)}
                <button onClick={() => removeFilter(i)} className="bg-transparent border-none p-0 cursor-pointer text-brand-500 hover:text-red-500 leading-none">
                  <X size={11} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Utility: apply smart filters to a data array
 * Supports AND/OR logic between filters, single-value and multi-value operators.
 *
 * Logic: filters are evaluated in order. Each filter has a `logic` property ('and' or 'or').
 * - 'and' (default): both this and previous result must be true
 * - 'or': either this or previous result must be true
 */
export function applySmartFilters(data, filters, fields) {
  if (!filters.length) return data;

  return data.filter(item => {
    let result = true;

    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      const match = evaluateFilter(item, f, fields);

      if (i === 0) {
        result = match;
      } else if (f.logic === 'or') {
        result = result || match;
      } else {
        // 'and' (default)
        result = result && match;
      }
    }

    return result;
  });
}

function evaluateFilter(item, f, fields) {
  const field = fields.find(fd => fd.id === f.field);
  if (!field) return true;
  const val = item[field.id];

  switch (f.operator) {
    case 'is': return String(val) === String(f.value);
    case 'is_not': return String(val) !== String(f.value);
    case 'in': return Array.isArray(f.value) && f.value.includes(String(val));
    case 'not_in': return Array.isArray(f.value) && !f.value.includes(String(val));
    case 'contains': return String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
    case 'not_contains': return !String(val || '').toLowerCase().includes(String(f.value).toLowerCase());
    case 'eq': return Number(val) === Number(f.value);
    case 'gt': return Number(val) > Number(f.value);
    case 'lt': return Number(val) < Number(f.value);
    case 'gte': return Number(val) >= Number(f.value);
    case 'lte': return Number(val) <= Number(f.value);
    case 'before': return val && new Date(val) < new Date(f.value);
    case 'after': return val && new Date(val) > new Date(f.value);
    case 'last_7': {
      if (!val) return false;
      const ago = new Date(); ago.setDate(ago.getDate() - 7);
      return new Date(val) >= ago;
    }
    case 'last_30': {
      if (!val) return false;
      const ago = new Date(); ago.setDate(ago.getDate() - 30);
      return new Date(val) >= ago;
    }
    case 'this_month': {
      if (!val) return false;
      const d = new Date(val); const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    case 'this_week': {
      if (!val) return false;
      const d = new Date(val); const now = new Date();
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    default: return true;
  }
}
