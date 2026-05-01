import { useState, useEffect, useRef } from 'react';
import { X, Merge, Briefcase, CheckCircle2, Send } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { updateContact, deleteContact } from '../../../services/contactsService';
import { createOpportunity } from '../../../services/opportunitiesService';
import { logAction } from '../../../services/auditService';
import { createNotification } from '../../../services/notificationsService';
import { getTemplates, renderBody } from '../../../services/smsTemplateService';
import { reportError } from '../../../utils/errorReporter';
import { getDeptStages } from './constants';
import { Button, SelectedContactsList } from '../../../components/ui';

// ── Merge Preview Modal ──────────────────────────────────────────────
export function MergePreviewModal({ mergePreview, setMergePreview, setMergeTargets, setMergeMode, contacts, setContacts, setSelectedIds, isRTL }) {
  const toast = useToast();
  const { profile } = useAuth();

  if (!mergePreview) return null;

  const mergedPair = mergePreview.map(id => (contacts || []).find(c => c.id === id)).filter(Boolean);
  if (mergedPair.length !== 2) return null;
  const [c1, c2] = mergedPair;
  // Merge: prefer c1 values, but fall back to c2 when c1 value is empty/null
  const merged = { ...c2 };
  Object.keys(c1).forEach(k => {
    if (c1[k] !== null && c1[k] !== undefined && c1[k] !== '') merged[k] = c1[k];
  });
  if (!merged.phone2 && c2.phone !== c1.phone) merged.phone2 = c2.phone;
  // Merge extra_phones from both contacts
  const allExtra = [...(c1.extra_phones || []), ...(c2.extra_phones || [])].filter(Boolean);
  merged.extra_phones = [...new Set(allExtra)].filter(p => p && p !== merged.phone && p !== merged.phone2);
  // Merge notes — concatenate when both non-empty so we don't lose richer context.
  // Audit caught this: previously c1 won outright, dropping c2's longer notes.
  if (c1.notes && c2.notes && c1.notes !== c2.notes) {
    merged.notes = `${c1.notes}\n---\n${c2.notes}`;
  }
  // Merge campaign_interactions — union of both arrays so marketing attribution survives.
  if (Array.isArray(c1.campaign_interactions) || Array.isArray(c2.campaign_interactions)) {
    const seen = new Set();
    merged.campaign_interactions = [...(c1.campaign_interactions || []), ...(c2.campaign_interactions || [])]
      .filter(i => {
        const key = JSON.stringify(i);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  // Merge assigned_to_names
  merged.assigned_to_names = [...new Set([...(c1.assigned_to_names || []), ...(c2.assigned_to_names || [])])].filter(Boolean);
  if ((c2.lead_score || 0) > (c1.lead_score || 0)) merged.lead_score = c2.lead_score;
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
          <Button size="sm" onClick={async () => {
            // Persist FIRST, mutate UI on success only — was previously
            // optimistic (update + delete in local state before awaits) which
            // left c2 deleted in UI even when the DB update of c1 failed.
            try {
              await updateContact(c1.id, merged);
            } catch (err) {
              toast.error(isRTL ? `فشل تحديث الليد المدموج: ${err.message || ''}` : `Merge update failed: ${err.message || ''}`);
              return;
            }
            try {
              await deleteContact(c2.id);
            } catch (err) {
              // c1 already updated. Warn that c2 still exists — admin can retry delete.
              toast.warning(isRTL
                ? `تم تحديث "${c1.full_name}" بنجاح، لكن فشل حذف "${c2.full_name}". احذفه يدوياً.`
                : `"${c1.full_name}" updated, but failed to delete "${c2.full_name}". Delete it manually.`);
              setMergePreview(null); setMergeTargets([]); setMergeMode(false); setSelectedIds([]);
              return;
            }
            // Both succeeded — apply local state
            const updatedContacts = (contacts || []).map(c => c.id === c1.id ? { ...c, ...merged, id: c1.id } : c).filter(c => c.id !== c2.id);
            setContacts(updatedContacts);
            logAction({ action: 'merge', entity: 'contact', entityId: c1.id, entityName: c1.full_name, description: `Merged "${c2.full_name}" (ID:${c2.id}) into "${c1.full_name}" (ID:${c1.id})`, userName: profile?.full_name_ar || profile?.full_name_en || '' }).catch(() => {});
            toast.success(isRTL ? 'تم دمج العميلين بنجاح' : 'Leads merged successfully');
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
  const trimmed = confirmText.trim();
  const isConfirmed = trimmed === requiredWord;
  const isMismatch = trimmed.length > 0 && !isConfirmed;
  const items = Array.isArray(confirmAction.items) ? confirmAction.items : [];
  const hasList = items.length > 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => { setConfirmAction(null); setConfirmText(''); }}>
      <div className={`modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/30 dark:border-red-500/30 rounded-2xl p-6 w-full ${hasList ? 'max-w-[520px]' : 'max-w-[420px] text-center'}`} onClick={e => e.stopPropagation()}>
        <div className={`${hasList ? 'flex items-center gap-3 mb-4' : ''}`}>
          <div className={`w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-xl shrink-0 ${hasList ? '' : 'mx-auto mb-4'}`}>⚠️</div>
          <div className={`${hasList ? 'flex-1' : ''}`}>
            <h3 className="m-0 mb-1 text-content dark:text-content-dark text-base font-bold">{confirmAction.title}</h3>
            <p className="m-0 text-content-muted dark:text-content-muted-dark text-xs">{confirmAction.message}</p>
          </div>
        </div>
        {hasList && (
          <>
            <p className="m-0 mb-2 text-xs font-semibold text-content dark:text-content-dark">
              {isRTL ? 'راجع القائمة قبل التأكيد:' : 'Review the list before confirming:'}
            </p>
            <div className="mb-4">
              <SelectedContactsList contacts={items} isRTL={isRTL} maxHeight={260} />
            </div>
          </>
        )}
        <p className="m-0 mb-2 text-xs text-red-500 font-semibold">
          {isRTL ? `اكتب "${requiredWord}" للتأكيد` : `Type "${requiredWord}" to confirm`}
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={requiredWord}
          autoFocus
          aria-invalid={isMismatch}
          className={`w-full px-3 py-2.5 mb-1 text-sm text-center rounded-lg border-2 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark font-cairo focus:outline-none transition-colors ${
            isConfirmed ? 'border-emerald-500 focus:border-emerald-500'
            : isMismatch ? 'border-red-500 focus:border-red-500'
            : 'border-red-500/30 focus:border-red-500'
          }`}
          dir="auto"
          onKeyDown={e => { if (e.key === 'Enter' && isConfirmed) { confirmAction.onConfirm(); setConfirmText(''); } }}
        />
        <p className={`m-0 mb-3 text-[11px] min-h-[14px] ${isMismatch ? 'text-red-500' : isConfirmed ? 'text-emerald-500' : 'text-transparent'}`}>
          {isMismatch
            ? (isRTL ? `الكلمة لا تطابق "${requiredWord}"` : `Doesn't match "${requiredWord}"`)
            : isConfirmed
            ? (isRTL ? '✓ مطابق — اضغط Enter للتأكيد' : '✓ Matched — press Enter to confirm')
            : '·'}
        </p>
        <div className={`flex gap-2.5 ${hasList ? 'justify-end' : 'justify-center'}`}>
          <button onClick={() => { setConfirmAction(null); setConfirmText(''); }} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <Button variant="danger" size="sm" disabled={!isConfirmed} onClick={() => { confirmAction.onConfirm(); setConfirmText(''); }}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Disqualify Modal ─────────────────────────────────────────────────
export function DisqualifyModal({ disqualifyModal, setDisqualifyModal, dqReason, setDqReason, dqNote, setDqNote, DQ_REASONS, contacts, setContacts, selectedIds, setSelectedIds, profile, isRTL }) {
  const toast = useToast();

  if (!disqualifyModal) return null;

  const isBulk = disqualifyModal === 'bulk';
  const bulkContacts = isBulk ? (contacts || []).filter(c => selectedIds.includes(c.id)) : [];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setDisqualifyModal(null)}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1200] flex items-center justify-center p-5">
      <div onClick={e => e.stopPropagation()}
        className={`bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full ${isBulk ? 'max-w-[500px]' : 'max-w-[400px]'} shadow-2xl`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-[15px] font-bold text-red-500">
            {isRTL ? (isBulk ? `غير مؤهل (${selectedIds.length})` : `غير مؤهل — ${disqualifyModal?.full_name}`) : (isBulk ? `Disqualify (${selectedIds.length})` : `Disqualify — ${disqualifyModal?.full_name}`)}
          </h3>
          <button onClick={() => setDisqualifyModal(null)} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark p-1 rounded">
            <X size={16} />
          </button>
        </div>
        {isBulk && bulkContacts.length > 0 && (
          <div className="mb-3.5">
            <div className="text-[11px] font-bold text-content dark:text-content-dark mb-1.5">
              {isRTL ? 'العملاء اللي هيتم استبعادهم:' : 'Contacts to disqualify:'}
            </div>
            <SelectedContactsList contacts={bulkContacts} isRTL={isRTL} maxHeight={220} />
          </div>
        )}
        <div className="text-xs text-content-muted dark:text-content-muted-dark mb-3">
          {isRTL ? 'اختر سبب الاستبعاد:' : 'Select disqualification reason:'}
        </div>
        <div className="flex flex-col gap-1.5 mb-3">
          {DQ_REASONS.map(r => (
            <button key={r.value} onClick={() => setDqReason(r.value)}
              className={`px-3.5 py-2.5 rounded-lg text-xs cursor-pointer text-start border transition-colors ${
                dqReason === r.value
                  ? 'border-red-500 bg-red-500/[0.08] text-red-500 font-bold'
                  : 'border-edge dark:border-edge-dark bg-surface-bg/40 dark:bg-brand-500/[0.03] text-content dark:text-content-dark hover:border-red-500/40'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <textarea value={dqNote} onChange={e => setDqNote(e.target.value)} rows={2}
          placeholder={isRTL ? 'ملاحظات إضافية (اختياري)...' : 'Additional notes (optional)...'}
          className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-xs text-content dark:text-content-dark outline-none resize-none font-cairo box-border mb-4 focus:border-red-500" />
        <div className="flex justify-end gap-2">
          <button onClick={() => setDisqualifyModal(null)}
            className="px-4 py-2 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-xs cursor-pointer font-semibold">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button disabled={!dqReason} onClick={async () => {
            const reasonLabel = DQ_REASONS.find(r => r.value === dqReason)?.label || dqReason;

            // Single-assignment DQ: contact_status flips to 'disqualified' for
            // everyone. Admin/Ops and the assigned agent both go through the
            // same path now — the per-agent slots are gone.
            const buildDqUpdates = () => ({
              contact_status: 'disqualified',
              disqualify_reason: dqReason,
              disqualify_note: dqNote || '',
            });

            if (disqualifyModal === 'bulk') {
              const ids = [...selectedIds];
              const names = (contacts || []).filter(c => ids.includes(c.id)).map(c => c.full_name).join(', ');
              const beforeMap = new Map((contacts || []).filter(c => ids.includes(c.id)).map(c => [c.id, c]));
              const updated = (contacts || []).map(c => {
                if (!ids.includes(c.id)) return c;
                return { ...c, ...buildDqUpdates() };
              });
              setContacts(updated);
              const results = await Promise.allSettled(ids.map(id =>
                updateContact(id, buildDqUpdates())
              ));
              const failedIds = results.map((r, i) => r.status === 'rejected' ? ids[i] : null).filter(Boolean);
              if (failedIds.length > 0) {
                // Roll back the optimistic state for the failed ones so the UI matches reality.
                setContacts(prev => prev.map(c => failedIds.includes(c.id) ? (beforeMap.get(c.id) || c) : c));
                toast.error(isRTL
                  ? `فشل استبعاد ${failedIds.length} من ${ids.length} عميل — حاول تاني`
                  : `${failedIds.length} of ${ids.length} disqualifications failed — please retry`);
              }
              const okCount = ids.length - failedIds.length;
              if (okCount > 0) {
                logAction({ action: 'bulk_disqualify', entity: 'contact', entityId: ids.filter(id => !failedIds.includes(id)).join(','), description: `Disqualified ${okCount} contacts (${reasonLabel}): ${names}`, userName: profile?.full_name_ar || profile?.full_name_en || '' }).catch(() => {});
                toast.success(isRTL ? `تم استبعاد ${okCount} عميل` : `${okCount} leads disqualified`);
              }
              setSelectedIds([]);
            } else {
              const c = disqualifyModal;
              const before = c;
              const dqUpdates = buildDqUpdates();
              const updated = (contacts || []).map(ct => ct.id === c.id ? { ...ct, ...dqUpdates } : ct);
              setContacts(updated);
              try {
                await updateContact(c.id, dqUpdates);
                logAction({ action: 'disqualify', entity: 'contact', entityId: c.id, description: `Disqualified ${c.full_name} (${reasonLabel})${dqNote ? ': ' + dqNote : ''}`, userName: profile?.full_name_ar || profile?.full_name_en || '' }).catch(() => {});
                toast.success(isRTL ? `تم استبعاد "${c.full_name}"` : `"${c.full_name}" disqualified`);
              } catch (err) {
                setContacts(prev => prev.map(ct => ct.id === c.id ? before : ct));
                toast.error(isRTL ? `فشل استبعاد "${c.full_name}" — حاول تاني` : `Failed to disqualify "${c.full_name}" — please retry`);
                if (import.meta.env.DEV) console.error('[disqualify] failed:', err?.message || err);
              }
            }
            setDisqualifyModal(null);
          }}
            className={`px-5 py-2 rounded-lg border-none text-white text-xs font-bold ${!dqReason ? 'bg-slate-500 cursor-not-allowed' : 'bg-red-500 cursor-pointer hover:bg-red-600'}`}>
            {isRTL ? 'تأكيد الاستبعاد' : 'Confirm Disqualify'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Reassign Modal ──────────────────────────────────────────────
export function BulkReassignModal({ bulkReassignModal, setBulkReassignModal, contacts, selectedIds, handleBulkReassign, isRTL }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [allAgents, setAllAgents] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTemp, setBulkTemp] = useState('');

  useEffect(() => {
    if (!bulkReassignModal) return;
    import('../../../services/opportunitiesService').then(({ fetchSalesAgents }) => {
      fetchSalesAgents().then(data => {
        setAllAgents((data || []).map(a => a.full_name_en || a.full_name_ar).filter(Boolean).sort());
      }).catch(() => {});
    });
  }, [bulkReassignModal]);

  if (!bulkReassignModal) return null;

  const agents = allAgents.length > 0 ? allAgents : [...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].sort();
  const filtered = search ? agents.filter(a => a.toLowerCase().includes(search.toLowerCase())) : agents;
  const selectedContacts = (contacts || []).filter(c => selectedIds.includes(c.id));

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1200] flex items-center justify-center p-5">
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[460px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header — stays anchored at top */}
        <div className="shrink-0 flex justify-between items-center px-5 py-4 border-b border-edge dark:border-edge-dark">
          <div>
            <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? 'إعادة تعيين' : 'Reassign'}
            </h3>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mt-0.5">
              {isRTL ? `${selectedIds.length} عميل محدد` : `${selectedIds.length} leads selected`}
            </p>
          </div>
          <button onClick={() => { setBulkReassignModal(false); setSearch(''); setSelected(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark hover:bg-surface-bg dark:hover:bg-surface-bg-dark">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body — only this area scrolls, header/footer stay visible */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Selected contacts preview */}
        {selectedContacts.length > 0 && (
          <div className="px-5 py-3 border-b border-edge/40 dark:border-edge-dark/40">
            <p className="m-0 mb-1.5 text-[11px] font-bold text-content dark:text-content-dark">
              {isRTL ? 'العملاء اللي هيتم نقلهم:' : 'Contacts to reassign:'}
            </p>
            <SelectedContactsList contacts={selectedContacts} isRTL={isRTL} maxHeight={180} />
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 border-b border-edge/40 dark:border-edge-dark/40">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'ابحث عن سيلز...' : 'Search agent...'}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark text-sm placeholder:text-content-muted/50 outline-none focus:border-brand-500"
          />
        </div>

        {/* Agent List */}
        <div className="max-h-[320px] overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-content-muted dark:text-content-muted-dark py-6">
              {isRTL ? 'مفيش نتائج' : 'No results'}
            </p>
          ) : filtered.map(agent => (
            <button key={agent} onClick={() => setSelected(agent)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 border-none cursor-pointer text-start transition-colors ${
                selected === agent
                  ? 'bg-brand-500/10 ring-1 ring-brand-500'
                  : 'bg-transparent hover:bg-surface-bg dark:hover:bg-surface-bg-dark'
              }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                selected === agent ? 'bg-brand-500 text-white' : 'bg-brand-500/10 text-brand-500'
              }`}>
                {agent.charAt(0).toUpperCase()}
              </div>
              <span className={`text-sm font-semibold ${
                selected === agent ? 'text-brand-500' : 'text-content dark:text-content-dark'
              }`}>
                {agent}
              </span>
            </button>
          ))}
        </div>

        {/* Bulk Status & Temperature */}
        {selected && (
          <div className="px-5 py-3 border-t border-edge/40 dark:border-edge-dark/40">
            <p className="m-0 mb-2 text-[11px] font-bold text-content-muted dark:text-content-muted-dark">
              {isRTL ? `تطبيق على ${selectedIds.length} عميل:` : `Apply to ${selectedIds.length} leads:`}
            </p>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الحالة' : 'Status'}</label>
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-xs text-content dark:text-content-dark">
                  <option value="">{isRTL ? 'بدون تغيير' : 'No change'}</option>
                  <option value="new">{isRTL ? 'جديد' : 'New'}</option>
                  <option value="active">{isRTL ? 'نشط' : 'Active'}</option>
                  <option value="inactive">{isRTL ? 'غير نشط' : 'Inactive'}</option>
                  <option value="has_opportunity">{isRTL ? 'لديه فرصة' : 'Has Opp'}</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الحرارة' : 'Temperature'}</label>
                <select value={bulkTemp} onChange={e => setBulkTemp(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-xs text-content dark:text-content-dark">
                  <option value="">{isRTL ? 'بدون تغيير' : 'No change'}</option>
                  <option value="hot">🔥 {isRTL ? 'حار' : 'Hot'}</option>
                  <option value="warm">{isRTL ? 'دافئ' : 'Warm'}</option>
                  <option value="cool">{isRTL ? 'فاتر' : 'Cool'}</option>
                  <option value="cold">{isRTL ? 'بارد' : 'Cold'}</option>
                </select>
              </div>
            </div>
          </div>
        )}
        </div>{/* end scrollable body */}

        {/* Footer — stays anchored at bottom */}
        <div className="shrink-0 px-5 py-4 border-t border-edge dark:border-edge-dark flex gap-3">
          <button onClick={() => { setBulkReassignModal(false); setSearch(''); setSelected(null); }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark text-xs font-semibold cursor-pointer">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => { if (selected) { handleBulkReassign(selected, bulkStatus, bulkTemp); setSearch(''); setSelected(null); setBulkStatus(''); setBulkTemp(''); } }}
            disabled={!selected}
            className={`flex-1 px-4 py-2.5 rounded-xl border-none text-xs font-bold cursor-pointer transition-colors ${
              selected ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark cursor-not-allowed'
            }`}>
            {isRTL ? `تعيين لـ ${selected || '...'}` : `Assign to ${selected || '...'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Create Opportunities Modal ──────────────────────────────────
export function BulkOppModal({ bulkOppModal, setBulkOppModal, bulkOppForm, setBulkOppForm, bulkOppSaving, setBulkOppSaving, contacts, selectedIds, setSelectedIds, setContacts, projectsList, profile, isRTL }) {
  const toast = useToast();
  const savingRef = useRef(false); // sync guard against double-submit

  if (!bulkOppModal) return null;

  const selContacts = (contacts || []).filter(c => selectedIds.includes(c.id));
  const agents = [...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))];
  const stages = getDeptStages('sales');

  const handleCreate = async () => {
    if (savingRef.current) return; // prevent double-submit
    if (!bulkOppForm.assigned_to_name) { toast.error(isRTL ? 'اختر السيلز المسؤول' : 'Select sales agent'); return; }
    savingRef.current = true;
    setBulkOppSaving(true);
    // Concurrency-limited parallel creates — was previously sequential, which made
    // 100-lead bulk-opp creation take 30+ seconds. Cap at 8 to be polite to RLS.
    const CONCURRENCY = 8;
    let created = 0;
    const queue = [...selContacts];
    const runWorker = async () => {
      while (queue.length) {
        const c = queue.shift();
        if (!c) return;
        try {
          await createOpportunity({
            contact_id: c.id,
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
        } catch (err) { reportError('BulkModals', 'bulkCreateOpportunity', err); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selContacts.length) }, () => runWorker()));
    logAction({ action: 'bulk_create_opportunities', entity: 'opportunity', description: `Created ${created} opportunities for ${selContacts.map(c => c.full_name).join(', ')} → ${bulkOppForm.assigned_to_name}`, userName: profile?.full_name_ar || profile?.full_name_en || '' });
    const selfName = isRTL ? (profile?.full_name_ar || profile?.full_name_en || '') : (profile?.full_name_en || profile?.full_name_ar || '');
    if (bulkOppForm.assigned_to_name !== selfName) {
      createNotification({ type: 'opportunity_assigned', title_ar: 'فرص جديدة', title_en: 'New Opportunities Assigned', body_ar: `تم تعيين ${created} فرصة لك بواسطة ${selfName}`, body_en: `${created} opportunities assigned to you by ${selfName}`, for_user_name: bulkOppForm.assigned_to_name, entity_type: 'opportunity', from_user: selfName });
    }
    toast.success(isRTL ? `تم إنشاء ${created} فرصة` : `${created} opportunities created`);
    setBulkOppSaving(false);
    savingRef.current = false;
    setBulkOppModal(false);
    setSelectedIds([]);
    // Refresh contacts
    try { const { fetchContacts: fc } = await import('../../../services/contactsService'); const fresh = await fc({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }); setContacts(fresh); } catch (err) { reportError('BulkModals', 'refreshContactsAfterBulkOpp', err); }
  };

  const fieldCls = "w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-xs text-content dark:text-content-dark outline-none focus:border-brand-500";
  const labelCls = "block text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1";
  const submitDisabled = bulkOppSaving || !bulkOppForm.assigned_to_name;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1200] flex items-center justify-center p-5">
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[440px] shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-emerald-500/10 flex items-center justify-center">
              <Briefcase size={18} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="m-0 text-[15px] font-bold text-content dark:text-content-dark">{isRTL ? 'إنشاء فرص' : 'Create Opportunities'}</h3>
              <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? `${selContacts.length} عميل محدد` : `${selContacts.length} leads selected`}</span>
            </div>
          </div>
          <button onClick={() => setBulkOppModal(false)} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark p-1">
            <X size={18} />
          </button>
        </div>

        {/* Selected contacts preview */}
        {selContacts.length > 0 && (
          <div className="mb-4">
            <SelectedContactsList contacts={selContacts} isRTL={isRTL} maxHeight={180} />
          </div>
        )}

        {/* Form */}
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>{isRTL ? 'السيلز المسؤول *' : 'Sales Agent *'}</label>
            <select value={bulkOppForm.assigned_to_name} onChange={e => setBulkOppForm(f => ({ ...f, assigned_to_name: e.target.value }))} className={fieldCls}>
              <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1">
              <label className={labelCls}>{isRTL ? 'المرحلة' : 'Stage'}</label>
              <select value={bulkOppForm.stage} onChange={e => setBulkOppForm(f => ({ ...f, stage: e.target.value }))} className={fieldCls}>
                {stages.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>{isRTL ? 'الأولوية' : 'Priority'}</label>
              <select value={bulkOppForm.priority} onChange={e => setBulkOppForm(f => ({ ...f, priority: e.target.value }))} className={fieldCls}>
                <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
                <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
                <option value="high">{isRTL ? 'عالية' : 'High'}</option>
                <option value="urgent">{isRTL ? 'عاجلة' : 'Urgent'}</option>
              </select>
            </div>
          </div>

          {projectsList.length > 0 && (
            <div>
              <label className={labelCls}>{isRTL ? 'المشروع' : 'Project'}</label>
              <select value={bulkOppForm.project_id} onChange={e => setBulkOppForm(f => ({ ...f, project_id: e.target.value }))} className={fieldCls}>
                <option value="">{isRTL ? '— بدون مشروع —' : '— No Project —'}</option>
                {projectsList.map(p => <option key={p.id} value={p.id}>{isRTL ? p.name_ar : p.name_en}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <textarea value={bulkOppForm.notes} onChange={e => setBulkOppForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
              className={`${fieldCls} resize-none font-cairo`} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setBulkOppModal(false)}
            className="px-4 py-2 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-xs cursor-pointer font-semibold">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleCreate} disabled={submitDisabled}
            className={`px-5 py-2 rounded-lg border-none text-white text-xs font-bold flex items-center gap-1.5 ${submitDisabled ? 'bg-slate-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 cursor-pointer'}`}>
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
  const selectedTemplate = (templates || []).find(t => t.id === bulkSMSState.templateId);
  const smsContacts = (contacts || []).filter(c => selectedIds.includes(c.id));
  const withPhone = smsContacts.filter(c => c.phone);
  const withoutPhone = smsContacts.filter(c => !c.phone);
  const lang = bulkSMSState.lang;
  const previewBody = selectedTemplate ? (lang === 'ar' ? (selectedTemplate.bodyAr || selectedTemplate.body) : selectedTemplate.body) : '';
  const previewRendered = previewBody ? renderBody(previewBody, { client_name: withPhone[0]?.full_name || 'Ahmed', client_phone: withPhone[0]?.phone || '', project_name: 'Sample Project', agent_name: profile?.full_name_ar || '', company_name: 'Platform', date: new Date().toLocaleDateString('en-GB'), amount: '' }) : '';

  const closeModal = () => { setBulkSMSModal(false); setBulkSMSState({ templateId: '', lang: 'en', sending: false, progress: 0, total: 0, done: false, results: [] }); };
  const sendDisabled = !bulkSMSState.templateId || withPhone.length === 0 || bulkSMSState.sending;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1200] flex items-center justify-center p-4">
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Send size={18} className="text-white" />
            <span className="text-white font-bold text-sm">{isRTL ? 'إرسال SMS جماعي' : 'Bulk SMS'}</span>
          </div>
          <button onClick={closeModal} aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="bg-white/15 hover:bg-white/25 border-none rounded-md w-7 h-7 flex items-center justify-center cursor-pointer text-white">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {bulkSMSState.done ? (
            /* Results view */
            <div>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <div className="text-base font-bold text-content dark:text-content-dark mb-1">
                  {isRTL ? 'تم الإرسال بنجاح' : 'SMS Sent Successfully'}
                </div>
                <div className="text-xs text-content-muted dark:text-content-muted-dark">
                  {isRTL ? `تم إرسال ${bulkSMSState.results.length} رسالة` : `${bulkSMSState.results.length} messages sent`}
                </div>
              </div>
              <div className="flex gap-2.5 justify-center">
                <button onClick={() => { closeModal(); setSelectedIds([]); }}
                  className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 border-none text-white text-xs font-semibold cursor-pointer">
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Template selector */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'اختر قالب الرسالة' : 'Select Template'}</label>
                <select value={bulkSMSState.templateId} onChange={e => setBulkSMSState(s => ({ ...s, templateId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none focus:border-brand-500">
                  <option value="">{isRTL ? '— اختر قالب —' : '-- Select Template --'}</option>
                  {(templates || []).map(t => (
                    <option key={t.id} value={t.id}>{lang === 'ar' ? (t.nameAr || t.name) : t.name}</option>
                  ))}
                </select>
              </div>

              {/* Language toggle */}
              <div className="mb-4 flex items-center gap-2">
                <label className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'لغة الرسالة:' : 'Message Language:'}</label>
                <div className="flex rounded-md overflow-hidden border border-edge dark:border-edge-dark">
                  <button onClick={() => setBulkSMSState(s => ({ ...s, lang: 'en' }))}
                    className={`px-3.5 py-1 border-none text-[11px] cursor-pointer font-semibold ${lang === 'en' ? 'bg-brand-500 text-white' : 'bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark'}`}>
                    EN
                  </button>
                  <button onClick={() => setBulkSMSState(s => ({ ...s, lang: 'ar' }))}
                    className={`px-3.5 py-1 border-none text-[11px] cursor-pointer font-semibold ${lang === 'ar' ? 'bg-brand-500 text-white' : 'bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark'}`}>
                    AR
                  </button>
                </div>
              </div>

              {/* Preview */}
              {selectedTemplate && (
                <div className="mb-4 bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark rounded-xl p-3.5">
                  <div className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark mb-1.5 uppercase tracking-wide">{isRTL ? 'معاينة الرسالة' : 'Message Preview'}</div>
                  <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="text-xs text-content dark:text-content-dark leading-relaxed whitespace-pre-wrap">
                    {previewRendered || (isRTL ? 'لا يمكن عرض المعاينة' : 'Cannot render preview')}
                  </div>
                </div>
              )}

              {/* Recipients summary */}
              <div className="mb-4 flex gap-2.5">
                <div className="flex-1 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl px-3.5 py-2.5 text-center">
                  <div className="text-xl font-bold text-emerald-500">{withPhone.length}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'سيتم الإرسال لهم' : 'Will receive'}</div>
                </div>
                <div className="flex-1 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3.5 py-2.5 text-center">
                  <div className="text-xl font-bold text-red-500">{withoutPhone.length}</div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'بدون رقم (سيتم تخطيهم)' : 'No phone (skipped)'}</div>
                </div>
              </div>

              {/* Skipped contacts list */}
              {withoutPhone.length > 0 && (
                <div className="mb-4 bg-red-500/[0.05] border border-red-500/15 rounded-lg px-3 py-2">
                  <div className="text-[10px] font-semibold text-red-500 mb-1">{isRTL ? 'عملاء بدون رقم:' : 'Leads without phone:'}</div>
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark">
                    {withoutPhone.map(c => c.full_name || (isRTL ? 'بدون اسم' : 'No Name')).join(', ')}
                  </div>
                </div>
              )}

              {/* Sending progress */}
              {bulkSMSState.sending && (
                <div className="mb-4">
                  <div className="h-1 rounded-sm bg-surface-bg dark:bg-surface-bg-dark overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-sm transition-[width] duration-300"
                      style={{ width: bulkSMSState.total > 0 ? `${(bulkSMSState.progress / bulkSMSState.total) * 100}%` : '0%' }} />
                  </div>
                  <div className="text-[10px] text-content-muted dark:text-content-muted-dark text-center mt-1">
                    {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 justify-end">
                <button onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={handleBulkSMS} disabled={sendDisabled}
                  className={`px-5 py-2 rounded-lg border-none text-xs font-semibold flex items-center gap-1.5 ${sendDisabled ? 'bg-surface-bg dark:bg-surface-bg-dark text-content-muted dark:text-content-muted-dark cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 text-white cursor-pointer'}`}>
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
