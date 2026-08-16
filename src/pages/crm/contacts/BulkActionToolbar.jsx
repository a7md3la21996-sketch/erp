import { Download, PhoneCall, Merge, X, Users, Tag, Building2, CheckCircle2, MessageSquare, ChevronDown, Briefcase, RefreshCw, Trash2, Megaphone } from 'lucide-react';
import { TYPE } from './constants';
import { fetchProjects } from '../../../services/opportunitiesService';

// Reusable button styles. Variant maps to a brand/emerald/red/info accent.
const btnBase = 'px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap transition-colors';
const btnVariants = {
  brand:   'border-brand-500/40 bg-brand-500/[0.08] hover:bg-brand-500/[0.18] text-content dark:text-content-dark',
  emerald: 'border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.18] text-emerald-500',
  info:    'border-blue-500/40 bg-blue-500/[0.10] hover:bg-blue-500/[0.20] text-blue-500',
  danger:  'border-red-500/40 bg-red-500/[0.10] hover:bg-red-500/[0.20] text-red-500',
};
const dropdownActiveCls = 'bg-brand-500/[0.20]';

// Dropdown panel styles. Pops above the button (toolbar is fixed at bottom).
// max-w cap + max-h with overflow-y-auto: on tiny phones the longest panel
// (statuses, sources) can otherwise extend past the viewport edge.
const dropdownPanelCls = 'absolute bottom-[110%] start-0 max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-y-auto bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] z-[301]';
const dropdownItemCls = 'w-full px-3.5 py-2 bg-transparent border-none text-content dark:text-content-dark text-[11px] cursor-pointer flex items-center gap-1.5 text-start hover:bg-brand-500/[0.15]';

export default function BulkActionToolbar({
  selectedIds,
  setSelectedIds,
  contacts,
  isRTL,
  // Bulk dropdown
  bulkDropdownOpen,
  setBulkDropdownOpen,
  // Options
  BULK_TYPE_OPTIONS,
  BULK_CATEGORY_OPTIONS,
  BULK_SOURCE_OPTIONS,
  BULK_DEPT_OPTIONS,
  BULK_STATUS_OPTIONS,
  // Handlers
  handleBulkChangeField,
  setBulkReassignModal,
  setBulkCampaignModal,
  setBulkDistributeOpen,
  setBulkOppModal,
  setBulkOppForm,
  setProjectsList,
  setBulkSMSModal,
  setBulkSMSState,
  exportSelectedCSV,
  setBatchCallMode,
  setBatchCallIndex,
  setBatchCallLog,
  setBatchCallNotes,
  setBatchCallResult,
  setMergePreview,
  handleDeleteSelected,
  setDisqualifyModal,
  setDqReason,
  setDqNote,
  MERGE_LIMIT,
  perms = {},
}) {
  if (selectedIds.length === 0) return null;

  const dropdownBtnCls = (key) => `${btnBase} ${btnVariants.brand} ${bulkDropdownOpen === key ? dropdownActiveCls : ''}`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}
      role="toolbar"
      aria-label={isRTL ? 'إجراءات جماعية' : 'Bulk actions'}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      className="fixed bottom-0 inset-x-0 z-[300] px-2.5 sm:px-5 pt-2.5 flex items-center gap-1.5 sm:gap-2 flex-wrap
                 bg-surface-card/95 dark:bg-surface-card-dark/95 backdrop-blur-sm
                 border-t border-edge dark:border-edge-dark
                 shadow-[0_-4px_20px_rgba(13,19,27,0.12)]">
      {/* Count + Deselect */}
      <div className="flex items-center gap-2 me-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-600 dark:text-brand-400">
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">{selectedIds.length}</span>
          {isRTL ? 'محدد' : 'selected'}
        </span>
        <button onClick={() => setSelectedIds([])}
          className="px-2.5 py-1 rounded-md border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-[11px] cursor-pointer flex items-center gap-1 hover:text-red-500 hover:border-red-500/40 transition-colors">
          <X size={11} /> {isRTL ? 'إلغاء' : 'Clear'}
        </button>
      </div>

      <div className="w-px h-6 bg-edge dark:bg-edge-dark" />

      {/* Change Type */}
      {perms.canBulkContacts && <div className="relative">
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'type' ? null : 'type')}
          aria-expanded={bulkDropdownOpen === 'type'} aria-haspopup="menu"
          className={`${dropdownBtnCls('type')}`}>
          <Tag size={12} /> {isRTL ? 'النوع' : 'Type'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'type' && (
          <div role="menu" className={`${dropdownPanelCls} min-w-[160px] max-w-[calc(100vw-2rem)]`}>
            {BULK_TYPE_OPTIONS.map(opt => (
              <button key={opt.value} role="menuitem" onClick={() => handleBulkChangeField('contact_type', opt.value, 'Type Change')} className={dropdownItemCls}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE[opt.value]?.color || '#2F6BD3' }} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Change Lead Category */}
      {perms.canBulkContacts && (BULK_CATEGORY_OPTIONS?.length > 0) && <div className="relative">
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'category' ? null : 'category')}
          aria-expanded={bulkDropdownOpen === 'category'} aria-haspopup="menu"
          className={`${dropdownBtnCls('category')}`}>
          <Tag size={12} /> {isRTL ? 'التصنيف' : 'Category'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'category' && (
          <div role="menu" className={`${dropdownPanelCls} min-w-[160px] max-w-[calc(100vw-2rem)]`}>
            {BULK_CATEGORY_OPTIONS.map(opt => (
              <button key={opt.value} role="menuitem" onClick={() => handleBulkChangeField('lead_category', opt.value, 'Category Change')} className={dropdownItemCls}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color || '#2F6BD3' }} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Change Source */}
      {perms.canBulkContacts && <div className="relative">
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'source' ? null : 'source')}
          aria-expanded={bulkDropdownOpen === 'source'} aria-haspopup="menu"
          className={`${dropdownBtnCls('source')}`}>
          <RefreshCw size={12} /> {isRTL ? 'المصدر' : 'Source'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'source' && (
          <div role="menu" className={`${dropdownPanelCls} min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[240px] overflow-y-auto`}>
            {BULK_SOURCE_OPTIONS.map(opt => (
              <button key={opt.value} role="menuitem" onClick={() => handleBulkChangeField('source', opt.value, 'Source Change')} className={dropdownItemCls}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Reassign */}
      {perms.canBulkContacts && <button onClick={() => setBulkReassignModal(true)}
        className={`${btnBase} ${btnVariants.brand}`}>
        <Users size={12} /> {isRTL ? 'تعيين لشخص واحد' : 'Reassign to one'}
      </button>}

      {/* Bulk Distribute */}
      {perms.canBulkContacts && setBulkDistributeOpen && <button onClick={() => setBulkDistributeOpen(true)}
        className={`${btnBase} ${btnVariants.emerald}`}>
        <Users size={12} /> {isRTL ? 'توزيع على فريق' : 'Distribute to team'}
      </button>}

      {/* Create Opportunities */}
      {perms.canBulkOpps && <button
        onClick={() => { setBulkOppModal(true); setBulkOppForm({ assigned_to_name: '', stage: 'qualification', priority: 'medium', notes: '', project_id: '' }); fetchProjects().then(p => setProjectsList(p)); }}
        className={`${btnBase} ${btnVariants.emerald}`}>
        <Briefcase size={12} /> {isRTL ? 'إنشاء فرص' : 'Create Opps'}
      </button>}

      {/* Change Department */}
      {perms.canBulkContacts && <div className="relative">
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'dept' ? null : 'dept')}
          aria-expanded={bulkDropdownOpen === 'dept'} aria-haspopup="menu"
          className={`${dropdownBtnCls('dept')}`}>
          <Building2 size={12} /> {isRTL ? 'القسم' : 'Dept'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'dept' && (
          <div role="menu" className={`${dropdownPanelCls} min-w-[150px] max-w-[calc(100vw-2rem)]`}>
            {BULK_DEPT_OPTIONS.map(opt => (
              <button key={opt.value} role="menuitem" onClick={() => handleBulkChangeField('department', opt.value, 'Department Change')} className={dropdownItemCls}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Change Status */}
      {perms.canBulkContacts && <div className="relative">
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'status' ? null : 'status')}
          aria-expanded={bulkDropdownOpen === 'status'} aria-haspopup="menu"
          className={`${dropdownBtnCls('status')}`}>
          <CheckCircle2 size={12} /> {isRTL ? 'الحالة' : 'Status'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'status' && (
          <div role="menu" className={`${dropdownPanelCls} min-w-[150px] max-w-[calc(100vw-2rem)]`}>
            {BULK_STATUS_OPTIONS.map(opt => (
              <button key={opt.value} role="menuitem"
                onClick={() => {
                  if (opt.value === 'disqualified') { setDisqualifyModal('bulk'); setDqReason(''); setDqNote(''); setBulkDropdownOpen(null); }
                  else handleBulkChangeField('contact_status', opt.value, 'Status Change');
                }}
                className={`${dropdownItemCls} ${opt.value === 'disqualified' ? 'text-red-500' : ''}`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Change Campaign */}
      {perms.canBulkContacts && setBulkCampaignModal && <button
        onClick={() => setBulkCampaignModal(true)}
        className={`${btnBase} ${btnVariants.brand}`}>
        <Megaphone size={12} /> {isRTL ? 'الحملة' : 'Campaign'}
      </button>}

      {/* Send SMS */}
      {(perms.canBulkContacts || perms.canBulkContactsBasic) && <button
        onClick={() => { setBulkSMSModal(true); setBulkSMSState({ templateId: '', lang: isRTL ? 'ar' : 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); }}
        className={`${btnBase} ${btnVariants.emerald}`}>
        <MessageSquare size={12} /> {isRTL ? 'رسالة SMS' : 'Send SMS'}
      </button>}

      {/* Export Selected */}
      {perms.canExportContacts && <button onClick={exportSelectedCSV}
        className={`${btnBase} ${btnVariants.brand}`}>
        <Download size={12} /> {isRTL ? 'تصدير' : 'Export'}
      </button>}

      {/* Batch Call */}
      {(perms.canBulkContacts || perms.canBulkContactsBasic) && <button
        onClick={() => { setBatchCallMode(true); setBatchCallIndex(0); setBatchCallLog([]); setBatchCallNotes(''); setBatchCallResult(''); }}
        className={`${btnBase} ${btnVariants.emerald}`}>
        <PhoneCall size={12} /> {isRTL ? 'اتصال جماعي' : 'Batch Call'}
      </button>}

      {/* Merge */}
      {perms.canDeleteContacts && selectedIds.length >= 2 && selectedIds.length <= MERGE_LIMIT && (
        <button onClick={() => { setMergePreview(selectedIds); }}
          className={`${btnBase} ${btnVariants.info}`}>
          <Merge size={12} /> {isRTL ? 'دمج' : 'Merge'}
        </button>
      )}

      <div className="flex-1" />

      {/* Delete Selected */}
      {perms.canDeleteContacts && <button onClick={handleDeleteSelected}
        className={`${btnBase} ${btnVariants.danger}`}>
        <Trash2 size={12} /> {isRTL ? 'حذف' : 'Delete'}
      </button>}
    </div>
  );
}
