import { useState } from 'react';
import { Phone, Download, PhoneCall, Merge, X, Users, UserPlus, UserMinus, Tag, Building2, CheckCircle2, MessageSquare, ChevronDown, Briefcase, RefreshCw, Trash2 } from 'lucide-react';
import { TYPE } from './constants';
import { fetchProjects } from '../../../services/opportunitiesService';

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
  BULK_SOURCE_OPTIONS,
  BULK_DEPT_OPTIONS,
  BULK_STATUS_OPTIONS,
  // Handlers
  handleBulkChangeField,
  setBulkReassignModal,
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
  handleBulkAddAgent,
  handleBulkRemoveAgent,
  perms = {},
}) {
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [addAgentSearch, setAddAgentSearch] = useState('');
  const [removeAgentOpen, setRemoveAgentOpen] = useState(false);
  const [removeAgentSearch, setRemoveAgentSearch] = useState('');

  if (selectedIds.length === 0) return null;

  const allAgents = [...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].sort();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        background: 'linear-gradient(135deg, #0a1929 0%, #132337 100%)',
        borderTop: '1px solid rgba(74,122,171,0.3)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
      }}>
      {/* Count + Deselect */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineEnd: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
          {isRTL ? `${selectedIds.length} محدد` : `${selectedIds.length} selected`}
        </span>
        <button onClick={() => setSelectedIds([])}
          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.3)', background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <X size={11} /> {isRTL ? 'إلغاء' : 'Clear'}
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'rgba(148,163,184,0.2)' }} />

      {/* Change Type */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'type' ? null : 'type')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: bulkDropdownOpen === 'type' ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <Tag size={12} /> {isRTL ? 'النوع' : 'Type'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'type' && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 160, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {BULK_TYPE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleBulkChangeField('contact_type', opt.value, 'Type Change')}
                style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,122,171,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE[opt.value]?.color || '#4A7AAB', flexShrink: 0 }} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Change Source */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'source' ? null : 'source')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: bulkDropdownOpen === 'source' ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <RefreshCw size={12} /> {isRTL ? 'المصدر' : 'Source'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'source' && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 160, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
            {BULK_SOURCE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleBulkChangeField('source', opt.value, 'Source Change')}
                style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,122,171,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reassign — admin/manager only */}
      {perms.canBulkContacts && <button onClick={() => setBulkReassignModal(true)}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <Users size={12} /> {isRTL ? 'إعادة تعيين' : 'Reassign'}
      </button>}

      {/* Add to Agent — admin/manager only */}
      {perms.canBulkContacts && <div style={{ position: 'relative' }}>
        <button onClick={() => { setAddAgentOpen(!addAgentOpen); setRemoveAgentOpen(false); setAddAgentSearch(''); }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: addAgentOpen ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <UserPlus size={12} /> {isRTL ? 'إضافة لسيلز' : 'Add Agent'}
        </button>
        {addAgentOpen && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 200, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ padding: 8 }}>
              <input type="text" value={addAgentSearch} onChange={e => setAddAgentSearch(e.target.value)}
                placeholder={isRTL ? 'ابحث...' : 'Search...'}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(74,122,171,0.3)', background: '#0d1b2a', color: '#e2e8f0', fontSize: 11, outline: 'none' }}
                autoFocus />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {allAgents.filter(a => !addAgentSearch || a.toLowerCase().includes(addAgentSearch.toLowerCase())).map(agent => (
                <button key={agent} onClick={() => { handleBulkAddAgent(agent); setAddAgentOpen(false); }}
                  style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(16,185,129,0.2)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{agent.charAt(0)}</span>
                  {agent}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* Remove from Agent — admin/manager only */}
      {perms.canBulkContacts && <div style={{ position: 'relative' }}>
        <button onClick={() => { setRemoveAgentOpen(!removeAgentOpen); setAddAgentOpen(false); setRemoveAgentSearch(''); }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: removeAgentOpen ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <UserMinus size={12} /> {isRTL ? 'شيل من سيلز' : 'Remove Agent'}
        </button>
        {removeAgentOpen && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 200, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ padding: 8 }}>
              <input type="text" value={removeAgentSearch} onChange={e => setRemoveAgentSearch(e.target.value)}
                placeholder={isRTL ? 'ابحث...' : 'Search...'}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(74,122,171,0.3)', background: '#0d1b2a', color: '#e2e8f0', fontSize: 11, outline: 'none' }}
                autoFocus />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {allAgents.filter(a => !removeAgentSearch || a.toLowerCase().includes(removeAgentSearch.toLowerCase())).map(agent => (
                <button key={agent} onClick={() => { handleBulkRemoveAgent(agent); setRemoveAgentOpen(false); }}
                  style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(239,68,68,0.2)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{agent.charAt(0)}</span>
                  {agent}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* Create Opportunities */}
      <button onClick={() => { setBulkOppModal(true); setBulkOppForm({ assigned_to_name: '', stage: 'qualification', priority: 'medium', notes: '', project_id: '' }); fetchProjects().then(p => setProjectsList(p)); }}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <Briefcase size={12} /> {isRTL ? 'إنشاء فرص' : 'Create Opps'}
      </button>

      {/* Change Department */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'dept' ? null : 'dept')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: bulkDropdownOpen === 'dept' ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <Building2 size={12} /> {isRTL ? 'القسم' : 'Dept'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'dept' && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 150, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {BULK_DEPT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleBulkChangeField('department', opt.value, 'Department Change')}
                style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,122,171,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Change Status */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setBulkDropdownOpen(bulkDropdownOpen === 'status' ? null : 'status')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: bulkDropdownOpen === 'status' ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <CheckCircle2 size={12} /> {isRTL ? 'الحالة' : 'Status'} <ChevronDown size={10} />
        </button>
        {bulkDropdownOpen === 'status' && (
          <div style={{ position: 'absolute', bottom: '110%', [isRTL ? 'right' : 'left']: 0, background: '#1a2332', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 10, minWidth: 150, zIndex: 301, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {BULK_STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => {
                if (opt.value === 'disqualified') { setDisqualifyModal('bulk'); setDqReason(''); setDqNote(''); setBulkDropdownOpen(null); }
                else handleBulkChangeField('contact_status', opt.value, 'Status Change');
              }}
                style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', color: opt.value === 'disqualified' ? '#EF4444' : '#e2e8f0', fontSize: 11, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,122,171,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Send SMS */}
      <button onClick={() => { setBulkSMSModal(true); setBulkSMSState({ templateId: '', lang: isRTL ? 'ar' : 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); }}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10B981', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <MessageSquare size={12} /> {isRTL ? 'رسالة SMS' : 'Send SMS'}
      </button>

      {/* Export Selected */}
      <button onClick={exportSelectedCSV}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.4)', background: 'rgba(74,122,171,0.08)', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <Download size={12} /> {isRTL ? 'تصدير' : 'Export'}
      </button>

      {/* Batch Call */}
      <button onClick={() => { setBatchCallMode(true); setBatchCallIndex(0); setBatchCallLog([]); setBatchCallNotes(''); setBatchCallResult(''); }}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <PhoneCall size={12} /> {isRTL ? 'اتصال جماعي' : 'Batch Call'}
      </button>

      {/* Merge (when selected count matches merge limit) */}
      {selectedIds.length >= 2 && selectedIds.length <= MERGE_LIMIT && (
        <button onClick={() => { setMergePreview(selectedIds); }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(30,64,175,0.4)', background: 'rgba(30,64,175,0.1)', color: '#93c5fd', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <Merge size={12} /> {isRTL ? 'دمج' : 'Merge'}
        </button>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Delete Selected */}
      <button onClick={handleDeleteSelected}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
        <Trash2 size={12} /> {isRTL ? 'حذف' : 'Delete'}
      </button>
    </div>
  );
}
