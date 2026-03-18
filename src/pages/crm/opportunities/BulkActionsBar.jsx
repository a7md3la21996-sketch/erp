import { CheckSquare, Trash2, Download, X } from 'lucide-react';
import { Button } from '../../../components/ui';
import { TEMP_CONFIG, PRIORITY_CONFIG } from './constants';

export default function BulkActionsBar({
  isRTL, isDark, lang,
  bulkSelected, bulkBarVisible, setBulkSelected, setBulkMode,
  bulkMoveAll, bulkAssign, bulkChangePriority, bulkChangeTemp, bulkExportCSV,
  setConfirmBulkDelete, confirmBulkDelete, bulkDeleteAll,
  currentStages, agents,
  canDelete = true, canExport = true,
}) {
  return (<>
    {/* Floating Bulk Action Bar */}
    {bulkSelected.size > 0 && (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          bottom: bulkBarVisible ? 24 : -80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          background: 'rgba(30,30,30,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 12,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          transition: 'bottom 0.3s cubic-bezier(0.4,0,0.2,1)',
          flexWrap: 'wrap',
          maxWidth: 'calc(100vw - 48px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <CheckSquare size={16} style={{ color: '#60A5FA' }} />
          <span>{bulkSelected.size} {isRTL ? '\u0645\u062D\u062F\u062F' : 'selected'}</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
        {[
          { label: isRTL ? '\u0646\u0642\u0644 \u0645\u0631\u062D\u0644\u0629' : 'Move Stage', handler: bulkMoveAll, options: currentStages.map(s => ({ value: s.id, label: isRTL ? s.label_ar : s.label_en })) },
          { label: isRTL ? '\u062A\u0639\u064A\u064A\u0646 \u0645\u0633\u0624\u0648\u0644' : 'Assign Agent', handler: bulkAssign, options: agents.map(a => ({ value: a.id, label: lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar) })) },
          { label: isRTL ? '\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629' : 'Priority', handler: bulkChangePriority, options: Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: isRTL ? v.label_ar : v.label_en })) },
          { label: isRTL ? '\u0627\u0644\u062D\u0631\u0627\u0631\u0629' : 'Temp', handler: bulkChangeTemp, options: Object.entries(TEMP_CONFIG).map(([k, v]) => ({ value: k, label: isRTL ? v.label_ar : v.label_en })) },
        ].map((action, i) => (
          <select
            key={i}
            onChange={e => { if (e.target.value) action.handler(e.target.value); e.target.value = ''; }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              minWidth: 110,
              appearance: 'none',
              WebkitAppearance: 'none',
              paddingRight: isRTL ? 10 : 24,
              paddingLeft: isRTL ? 24 : 10,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: isRTL ? '8px center' : 'calc(100% - 8px) center',
            }}
          >
            <option value="" style={{ background: '#1e1e1e' }}>{action.label}</option>
            {action.options.map(o => <option key={o.value} value={o.value} style={{ background: '#1e1e1e' }}>{o.label}</option>)}
          </select>
        ))}
        {canExport && (
          <button
            onClick={bulkExportCSV}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >
            <Download size={14} />
            {isRTL ? '\u062A\u0635\u062F\u064A\u0631' : 'Export'}
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => setConfirmBulkDelete(true)}
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#FCA5A5', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
          >
            <Trash2 size={14} />
            {isRTL ? '\u062D\u0630\u0641' : 'Delete'}
          </button>
        )}
        <button
          onClick={() => { setBulkSelected(new Set()); setBulkMode(false); }}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <X size={16} />
        </button>
      </div>
    )}

    {/* Bulk Delete Confirmation Modal */}
    {confirmBulkDelete && (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setConfirmBulkDelete(false)}>
        <div
          style={{ background: isDark ? '#1E293B' : '#fff', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, textAlign: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Trash2 size={20} style={{ color: '#EF4444' }} />
          </div>
          <h3 style={{ margin: '0 0 8px', color: isDark ? '#F1F5F9' : '#1E293B', fontSize: 16, fontWeight: 700 }}>
            {isRTL ? '\u062D\u0630\u0641 \u0641\u0631\u0635' : 'Delete Opportunities'}
          </h3>
          <p style={{ margin: '0 0 20px', color: isDark ? '#94A3B8' : '#64748B', fontSize: 13 }}>
            {isRTL
              ? `\u0647\u0644 \u0623\u0646\u062A \u0645\u062A\u0623\u0643\u062F \u0645\u0646 \u062D\u0630\u0641 ${bulkSelected.size} \u0641\u0631\u0635\u0629\u061F \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621.`
              : `Are you sure you want to delete ${bulkSelected.size} opportunities? This action cannot be undone.`}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmBulkDelete(false)}>
              {isRTL ? '\u0625\u0644\u063A\u0627\u0621' : 'Cancel'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setConfirmBulkDelete(false); bulkDeleteAll(); }}>
              <Trash2 size={13} /> {isRTL ? '\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u0630\u0641' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </div>
    )}
  </>);
}
