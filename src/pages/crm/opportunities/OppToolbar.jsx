import { useRef, useState, useEffect } from 'react';
import { X, Bookmark, CheckSquare, List, Columns } from 'lucide-react';
import { Button, Input, SmartFilter } from '../../../components/ui';
import { saveSavedFilters } from './constants';

export default function OppToolbar({
  isRTL, SMART_FIELDS, smartFilters, setSmartFilters, setActiveStage,
  searchInput, setSearchInput, SMART_SORT_OPTIONS, sortBy, setSortBy,
  filteredCount,
  savedFilters, setSavedFilters, filterName, setFilterName,
  setSearch, activeStage,
  bulkMode, setBulkMode, setBulkSelected,
  viewMode, setViewMode,
}) {
  const savedFilterRef = useRef(null);
  const [showSaveFilter, setShowSaveFilter] = useState(false);

  // Click-outside for saved filters dropdown
  useEffect(() => {
    if (!showSaveFilter) return;
    const h = (e) => { if (savedFilterRef.current && !savedFilterRef.current.contains(e.target)) setShowSaveFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSaveFilter]);

  return (
    <SmartFilter
      fields={SMART_FIELDS}
      filters={smartFilters}
      onFiltersChange={(f) => { setSmartFilters(f); setActiveStage('all'); }}
      search={searchInput}
      onSearchChange={setSearchInput}
      searchPlaceholder={isRTL ? 'بحث بالاسم، المشروع، الهاتف...' : 'Search name, project, phone...'}
      sortOptions={SMART_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      resultsCount={filteredCount}
      extraActions={<>
        {/* Save / Load Filters */}
        <div className="relative" ref={savedFilterRef}>
          <Button variant="ghost" size="sm" onClick={() => setShowSaveFilter(s => !s)} title={isRTL ? 'حفظ / تحميل فلتر' : 'Save / Load Filter'}>
            <Bookmark size={14} />
          </Button>
          {showSaveFilter && (
            <div className="absolute top-full mt-1 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-50 p-3 w-[220px]" style={{ [isRTL ? 'right' : 'left']: 0 }}>
              <div className="flex gap-1.5 mb-2">
                <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder={isRTL ? 'اسم الفلتر...' : 'Filter name...'} className="text-xs flex-1" />
                <Button size="sm" onClick={() => {
                  if (!filterName.trim()) return;
                  const f = { name: filterName, search: searchInput, smartFilters, sortBy, activeStage };
                  const all = [...savedFilters, f];
                  saveSavedFilters(all); setSavedFilters(all); setFilterName('');
                }}>{isRTL ? 'حفظ' : 'Save'}</Button>
              </div>
              {savedFilters.length > 0 && (
                <div className="border-t border-edge dark:border-edge-dark pt-2 max-h-[150px] overflow-y-auto">
                  {savedFilters.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 px-1.5 rounded-md transition-colors">
                      <button onClick={() => {
                        setSearchInput(f.search || ''); setSearch(f.search || '');
                        setSmartFilters(f.smartFilters || []); setSortBy(f.sortBy || 'newest');
                        setActiveStage(f.activeStage || 'all'); setShowSaveFilter(false);
                      }} className="bg-transparent border-none cursor-pointer text-xs text-content dark:text-content-dark font-semibold font-cairo truncate flex-1 text-start">{f.name}</button>
                      <button onClick={() => {
                        const all = savedFilters.filter((_, j) => j !== i);
                        saveSavedFilters(all); setSavedFilters(all);
                      }} className="bg-transparent border-none cursor-pointer text-red-400 p-0.5 shrink-0"><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          variant={bulkMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
          title={isRTL ? 'تحديد متعدد' : 'Bulk Select'}
        >
          <CheckSquare size={14} />
        </Button>
        <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
          <button onClick={() => setViewMode('table')} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><List size={14} /></button>
          <button onClick={() => { setViewMode('kanban'); setActiveStage('all'); }} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'kanban' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><Columns size={14} /></button>
        </div>
      </>}
    />
  );
}
