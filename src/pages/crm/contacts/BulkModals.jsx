import { useState } from 'react';
import { X, Merge, Briefcase, CheckCircle2, Send } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { updateContact } from '../../../services/contactsService';
import { createOpportunity } from '../../../services/opportunitiesService';
import { logAction } from '../../../services/auditService';
import { createNotification } from '../../../services/notificationsService';
import { getTemplates, renderBody } from '../../../services/smsTemplateService';
import { getDeptStages } from './constants';
import { Button } from '../../../components/ui';

// ── Merge Preview Modal ──────────────────────────────────────────────
export function MergePreviewModal({ mergePreview, setMergePreview, setMergeTargets, setMergeMode, contacts, setContacts, setSelectedIds, isRTL }) {
  const toast = useToast();

  if (!mergePreview) return null;

  const [c1, c2] = mergePreview.map(id => contacts.find(c => c.id === id)).filter(Boolean);
  if (!c1 || !c2) return null;
  const merged = { ...c2, ...c1 };
  if (!c1.email && c2.email) merged.email = c2.email;
  if (!c1.phone2 && c2.phone2) merged.phone2 = c2.phone2;
  if (!c1.phone2 && c2.phone !== c1.phone) merged.phone2 = c2.phone;
  if ((c2.lead_score || 0) > (c1.lead_score || 0)) merged.lead_score = c2.lead_score;
  if (!c1.company && c2.company) merged.company = c2.company;
  if (!c1.preferred_location && c2.preferred_location) merged.preferred_location = c2.preferred_location;
  const fields = ['full_name','phone','phone2','email','contact_type','source','department','temperature','company','preferred_location'];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-3 sm:p-5">
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-content dark:text-content-dark text-base font-bold flex items-center gap-2"><Merge size={18} color="#1E40AF" /> {isRTL ? 'معاينة الدمج' : 'Merge Preview'}</h3>
          <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={18} /></button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs min-w-[450px]">
          <thead>
            <tr>
              <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'الحقل' : 'Field'}</th>
              <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c1.full_name}</th>
              <th className={`px-2.5 py-2 text-start text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c2.full_name}</th>
              <th className={`px-2.5 py-2 text-start text-emerald-500 font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'النتيجة' : 'Result'}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f} className="border-b border-edge dark:border-edge-dark">
                <td className="px-2.5 py-2 font-semibold text-content-muted dark:text-content-muted-dark">{f}</td>
                <td className={`px-2.5 py-2 ${merged[f] === c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c1[f] || '—'}</td>
                <td className={`px-2.5 py-2 ${merged[f] === c2[f] && merged[f] !== c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c2[f] || '—'}</td>
                <td className="px-2.5 py-2 font-semibold text-emerald-500">{merged[f] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex gap-2.5 mt-5 justify-end">
          <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <Button size="sm" onClick={() => {
            const updatedContacts = contacts.map(c => c.id === c1.id ? { ...c, ...merged, id: c1.id } : c).filter(c => c.id !== c2.id);
            setContacts(updatedContacts);
            localStorage.setItem('platform_contacts', JSON.stringify(updatedContacts));
            toast.success(isRTL ? 'تم دمج جهتي الاتصال بنجاح' : 'Contacts merged successfully');
            setMergePreview(null); setMergeTargets([]); setMergeMode(false); setSelectedIds([]);
          }}>
            {isRTL ? 'تأكيد الدمج' : 'Confirm Merge'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete Modal (requires typing confirmation) ──────────────
export function ConfirmModal({ confirmAction, setConfirmAction, isRTL }) {
  const [confirmText, setConfirmText] = useState('');

  if (!confirmAction) return null;

  const requiredWord = isRTL ? 'حذف' : 'DELETE';
  const isConfirmed = confirmText.trim() === requiredWord;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => { setConfirmAction(null); setConfirmText(''); }}>
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/30 dark:border-red-500/30 rounded-2xl p-7 w-full max-w-[420px] text-center" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
        <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">{confirmAction.title}</h3>
        <p className="m-0 mb-4 text-content-muted dark:text-content-muted-dark text-xs">{confirmAction.message}</p>
        <p className="m-0 mb-2 text-xs text-red-500 font-semibold">
          {isRTL ? `اكتب "${requiredWord}" للتأكيد` : `Type "${requiredWord}" to confirm`}
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={requiredWord}
          autoFocus
          className="w-full px-3 py-2.5 mb-4 text-sm text-center rounded-lg border-2 border-red-500/30 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark font-cairo focus:outline-none focus:border-red-500 transition-colors"
          dir="auto"
          onKeyDown={e => { if (e.key === 'Enter' && isConfirmed) { confirmAction.onConfirm(); setConfirmText(''); } }}
        />
        <div className="flex gap-2.5 justify-center">
          <button onClick={() => { setConfirmAction(null); setConfirmText(''); }} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <Button variant="danger" size="sm" disabled={!isConfirmed} onClick={() => { confirmAction.onConfirm(); setConfirmText(''); }}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Disqualify Modal ─────────────────────────────────────────────────
export function DisqualifyModal({ disqualifyModal, setDisqualifyModal, dqReason, setDqReason, dqNote, setDqNote, DQ_REASONS, contacts, setContacts, selectedIds, setSelectedIds, profile, isRTL }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const toast = useToast();

  if (!disqualifyModal) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setDisqualifyModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: isDark ? '#1a2332' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: isDark ? '0 24px 48px rgba(0,0,0,0.4)' : '0 24px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#EF4444' }}>
            {isRTL ? (disqualifyModal === 'bulk' ? `غير مؤهل (${selectedIds.length})` : `غير مؤهل — ${disqualifyModal?.full_name}`) : (disqualifyModal === 'bulk' ? `Disqualify (${selectedIds.length})` : `Disqualify — ${disqualifyModal?.full_name}`)}
          </h3>
          <button onClick={() => setDisqualifyModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#64748b' : '#94a3b8' }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 12 }}>{isRTL ? 'اختر سبب الاستبعاد:' : 'Select disqualification reason:'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {DQ_REASONS.map(r => (
            <button key={r.value} onClick={() => setDqReason(r.value)}
              style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', border: dqReason === r.value ? '1px solid #EF4444' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: dqReason === r.value ? 'rgba(239,68,68,0.08)' : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'), color: dqReason === r.value ? '#EF4444' : (isDark ? '#e2e8f0' : '#1e293b'), fontWeight: dqReason === r.value ? 700 : 400 }}>
              {r.label}
            </button>
          ))}
        </div>
        <textarea value={dqNote} onChange={e => setDqNote(e.target.value)} rows={2} placeholder={isRTL ? 'ملاحظات إضافية (اختياري)...' : 'Additional notes (optional)...'}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setDisqualifyModal(null)}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'none', color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button disabled={!dqReason} onClick={async () => {
            const reasonLabel = DQ_REASONS.find(r => r.value === dqReason)?.label || dqReason;
            const updates = { contact_status: 'disqualified', disqualify_reason: dqReason, disqualify_note: dqNote || '' };
            if (disqualifyModal === 'bulk') {
              const ids = [...selectedIds];
              const names = contacts.filter(c => ids.includes(c.id)).map(c => c.full_name).join(', ');
              const updated = contacts.map(c => ids.includes(c.id) ? { ...c, ...updates } : c);
              setContacts(updated);
              try { localStorage.setItem('platform_contacts', JSON.stringify(updated)); } catch {}
              await Promise.all(ids.map(id => updateContact(id, updates).catch(err => { console.error('Disqualify failed for', id, err); toast.error(isRTL ? `فشل تحديث جهة اتصال` : `Failed to update a contact`); })));
              logAction({ action: 'bulk_disqualify', entity: 'contact', entityId: ids.join(','), description: `Disqualified ${ids.length} contacts (${reasonLabel}): ${names}`, userName: profile?.full_name_ar });
              toast.success(isRTL ? `تم استبعاد ${ids.length} جهة اتصال` : `${ids.length} contacts disqualified`);
              setSelectedIds([]);
            } else {
              const c = disqualifyModal;
              const updated = contacts.map(ct => ct.id === c.id ? { ...ct, ...updates } : ct);
              setContacts(updated);
              try { localStorage.setItem('platform_contacts', JSON.stringify(updated)); } catch {}
              await updateContact(c.id, updates).catch(err => { console.error('Disqualify failed for', c.id, err); toast.error(isRTL ? 'فشل تحديث جهة الاتصال' : 'Failed to update contact'); });
              logAction({ action: 'disqualify', entity: 'contact', entityId: c.id, description: `Disqualified ${c.full_name} (${reasonLabel})${dqNote ? ': ' + dqNote : ''}`, userName: profile?.full_name_ar });
              toast.success(isRTL ? `تم استبعاد "${c.full_name}"` : `"${c.full_name}" disqualified`);
            }
            setDisqualifyModal(null);
          }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: !dqReason ? '#64748b' : '#EF4444', color: '#fff', fontSize: 12, cursor: !dqReason ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {isRTL ? 'تأكيد الاستبعاد' : 'Confirm Disqualify'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Reassign Modal ──────────────────────────────────────────────
export function BulkReassignModal({ bulkReassignModal, setBulkReassignModal, contacts, selectedIds, handleBulkReassign, isRTL }) {
  if (!bulkReassignModal) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface-card, #fff)', border: '1px solid var(--edge, #e2e8f0)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{isRTL ? `إعادة تعيين (${selectedIds.length})` : `Reassign (${selectedIds.length})`}</h3>
          <button onClick={() => setBulkReassignModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].map(agent => (
            <button key={agent} onClick={() => handleBulkReassign(agent)}
              style={{ padding: '10px 14px', background: 'rgba(74,122,171,0.06)', border: '1px solid var(--edge, #e2e8f0)', borderRadius: 8, fontSize: 12, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>
              {agent}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bulk Create Opportunities Modal ──────────────────────────────────
export function BulkOppModal({ bulkOppModal, setBulkOppModal, bulkOppForm, setBulkOppForm, bulkOppSaving, setBulkOppSaving, contacts, selectedIds, setSelectedIds, setContacts, projectsList, profile, isRTL }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const toast = useToast();

  if (!bulkOppModal) return null;

  const selContacts = contacts.filter(c => selectedIds.includes(c.id));
  const agents = [...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))];
  const stages = getDeptStages('sales');

  const handleCreate = async () => {
    if (!bulkOppForm.assigned_to_name) { toast.error(isRTL ? 'اختر السيلز المسؤول' : 'Select sales agent'); return; }
    setBulkOppSaving(true);
    let created = 0;
    for (const c of selContacts) {
      try {
        await createOpportunity({
          contact_id: c.id,
          assigned_to: null,
          assigned_to_name: bulkOppForm.assigned_to_name,
          stage: bulkOppForm.stage,
          priority: bulkOppForm.priority,
          notes: bulkOppForm.notes,
          project_id: bulkOppForm.project_id || null,
          title: c.full_name,
          source: c.source || 'manual',
          created_by: profile?.id || null,
          created_by_name: profile?.full_name_ar || profile?.full_name_en || null,
        });
        created++;
      } catch { /* skip */ }
    }
    logAction({ action: 'bulk_create_opportunities', entity: 'opportunity', description: `Created ${created} opportunities for ${selContacts.map(c => c.full_name).join(', ')} → ${bulkOppForm.assigned_to_name}`, userName: profile?.full_name_ar });
    const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
    if (bulkOppForm.assigned_to_name !== selfName) {
      createNotification({ type: 'opportunity_assigned', title_ar: 'فرص جديدة', title_en: 'New Opportunities Assigned', body_ar: `تم تعيين ${created} فرصة لك بواسطة ${selfName}`, body_en: `${created} opportunities assigned to you by ${selfName}`, for_user_name: bulkOppForm.assigned_to_name, entity_type: 'opportunity', from_user: selfName });
    }
    toast.success(isRTL ? `تم إنشاء ${created} فرصة` : `${created} opportunities created`);
    setBulkOppSaving(false);
    setBulkOppModal(false);
    setSelectedIds([]);
    // Refresh contacts
    try { const { fetchContacts: fc } = await import('../../../services/contactsService'); const fresh = await fc({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }); setContacts(fresh); } catch { /* ignore */ }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: isDark ? '#1a2332' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: isDark ? '0 24px 48px rgba(0,0,0,0.4)' : '0 24px 48px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={18} color="#10B981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>{isRTL ? 'إنشاء فرص' : 'Create Opportunities'}</h3>
              <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>{isRTL ? `${selContacts.length} جهة اتصال محددة` : `${selContacts.length} contacts selected`}</span>
            </div>
          </div>
          <button onClick={() => setBulkOppModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#64748b' : '#94a3b8', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Selected contacts preview */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16, maxHeight: 60, overflowY: 'auto' }}>
          {selContacts.slice(0, 8).map(c => (
            <span key={c.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)', color: isDark ? '#7db4d8' : '#4A7AAB', fontWeight: 600 }}>{c.full_name}</span>
          ))}
          {selContacts.length > 8 && <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8' }}>+{selContacts.length - 8}</span>}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sales Agent */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4 }}>{isRTL ? 'السيلز المسؤول *' : 'Sales Agent *'}</label>
            <select value={bulkOppForm.assigned_to_name} onChange={e => setBulkOppForm(f => ({ ...f, assigned_to_name: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}>
              <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Stage + Priority row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4 }}>{isRTL ? 'المرحلة' : 'Stage'}</label>
              <select value={bulkOppForm.stage} onChange={e => setBulkOppForm(f => ({ ...f, stage: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}>
                {stages.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4 }}>{isRTL ? 'الأولوية' : 'Priority'}</label>
              <select value={bulkOppForm.priority} onChange={e => setBulkOppForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}>
                <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
                <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
                <option value="high">{isRTL ? 'عالية' : 'High'}</option>
                <option value="urgent">{isRTL ? 'عاجلة' : 'Urgent'}</option>
              </select>
            </div>
          </div>

          {/* Project */}
          {projectsList.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4 }}>{isRTL ? 'المشروع' : 'Project'}</label>
              <select value={bulkOppForm.project_id} onChange={e => setBulkOppForm(f => ({ ...f, project_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none' }}>
                <option value="">{isRTL ? '— بدون مشروع —' : '— No Project —'}</option>
                {projectsList.map(p => <option key={p.id} value={p.id}>{isRTL ? p.name_ar : p.name_en}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <textarea value={bulkOppForm.notes} onChange={e => setBulkOppForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={() => setBulkOppModal(false)}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'none', color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleCreate} disabled={bulkOppSaving || !bulkOppForm.assigned_to_name}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: bulkOppSaving || !bulkOppForm.assigned_to_name ? '#64748b' : '#10B981', color: '#fff', fontSize: 12, cursor: bulkOppSaving ? 'wait' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            {bulkOppSaving ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? `إنشاء ${selContacts.length} فرصة` : `Create ${selContacts.length} Opps`)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk SMS Modal ───────────────────────────────────────────────────
export function BulkSMSModal({ bulkSMSModal, setBulkSMSModal, bulkSMSState, setBulkSMSState, contacts, selectedIds, setSelectedIds, handleBulkSMS, profile, isRTL }) {
  if (!bulkSMSModal) return null;

  const templates = getTemplates();
  const selectedTemplate = templates.find(t => t.id === bulkSMSState.templateId);
  const smsContacts = contacts.filter(c => selectedIds.includes(c.id));
  const withPhone = smsContacts.filter(c => c.phone);
  const withoutPhone = smsContacts.filter(c => !c.phone);
  const lang = bulkSMSState.lang;
  const previewBody = selectedTemplate ? (lang === 'ar' ? (selectedTemplate.bodyAr || selectedTemplate.body) : selectedTemplate.body) : '';
  const previewRendered = previewBody ? renderBody(previewBody, { client_name: withPhone[0]?.full_name || 'Ahmed', client_phone: withPhone[0]?.phone || '', project_name: 'Sample Project', agent_name: profile?.full_name_ar || '', company_name: 'Platform', date: new Date().toLocaleDateString('en-GB'), amount: '' }) : '';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0a1929', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #4A7AAB 0%, #2B4C6F 100%)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Send size={18} color="#fff" />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{isRTL ? 'إرسال SMS جماعي' : 'Bulk SMS'}</span>
          </div>
          <button onClick={() => { setBulkSMSModal(false); setBulkSMSState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {bulkSMSState.done ? (
            /* Results view */
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <CheckCircle2 size={28} color="#10B981" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                  {isRTL ? 'تم الإرسال بنجاح' : 'SMS Sent Successfully'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {isRTL ? `تم إرسال ${bulkSMSState.results.length} رسالة` : `${bulkSMSState.results.length} messages sent`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { setBulkSMSModal(false); setBulkSMSState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); setSelectedIds([]); }}
                  style={{ padding: '8px 20px', borderRadius: 8, background: '#4A7AAB', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Template selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{isRTL ? 'اختر قالب الرسالة' : 'Select Template'}</label>
                <select value={bulkSMSState.templateId} onChange={e => setBulkSMSState(s => ({ ...s, templateId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(74,122,171,0.3)', background: '#132337', color: '#e2e8f0', fontSize: 12, outline: 'none' }}>
                  <option value="">{isRTL ? '— اختر قالب —' : '-- Select Template --'}</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{lang === 'ar' ? (t.nameAr || t.name) : t.name}</option>
                  ))}
                </select>
              </div>

              {/* Language toggle */}
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{isRTL ? 'لغة الرسالة:' : 'Message Language:'}</label>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(74,122,171,0.3)' }}>
                  <button onClick={() => setBulkSMSState(s => ({ ...s, lang: 'en' }))}
                    style={{ padding: '4px 14px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600, background: lang === 'en' ? '#4A7AAB' : '#132337', color: lang === 'en' ? '#fff' : '#94a3b8' }}>
                    EN
                  </button>
                  <button onClick={() => setBulkSMSState(s => ({ ...s, lang: 'ar' }))}
                    style={{ padding: '4px 14px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600, background: lang === 'ar' ? '#4A7AAB' : '#132337', color: lang === 'ar' ? '#fff' : '#94a3b8' }}>
                    AR
                  </button>
                </div>
              </div>

              {/* Preview */}
              {selectedTemplate && (
                <div style={{ marginBottom: 16, background: '#132337', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{isRTL ? 'معاينة الرسالة' : 'Message Preview'}</div>
                  <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {previewRendered || (isRTL ? 'لا يمكن عرض المعاينة' : 'Cannot render preview')}
                  </div>
                </div>
              )}

              {/* Recipients summary */}
              <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{withPhone.length}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{isRTL ? 'سيتم الإرسال لهم' : 'Will receive'}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444' }}>{withoutPhone.length}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{isRTL ? 'بدون رقم (سيتم تخطيهم)' : 'No phone (skipped)'}</div>
                </div>
              </div>

              {/* Skipped contacts list */}
              {withoutPhone.length > 0 && (
                <div style={{ marginBottom: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', marginBottom: 4 }}>{isRTL ? 'جهات بدون رقم:' : 'Contacts without phone:'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {withoutPhone.map(c => c.full_name || (isRTL ? 'بدون اسم' : 'No Name')).join(', ')}
                  </div>
                </div>
              )}

              {/* Sending progress */}
              {bulkSMSState.sending && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#1a2332', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#4A7AAB', borderRadius: 2, width: bulkSMSState.total > 0 ? `${(bulkSMSState.progress / bulkSMSState.total) * 100}%` : '0%', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
                    {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setBulkSMSModal(false); setBulkSMSState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={handleBulkSMS} disabled={!bulkSMSState.templateId || withPhone.length === 0 || bulkSMSState.sending}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: (!bulkSMSState.templateId || withPhone.length === 0 || bulkSMSState.sending) ? '#1a2332' : '#4A7AAB', color: (!bulkSMSState.templateId || withPhone.length === 0 || bulkSMSState.sending) ? '#64748b' : '#fff', fontSize: 12, cursor: (!bulkSMSState.templateId || withPhone.length === 0 || bulkSMSState.sending) ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send size={13} />
                  {bulkSMSState.sending ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? `إرسال (${withPhone.length})` : `Send (${withPhone.length})`)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
