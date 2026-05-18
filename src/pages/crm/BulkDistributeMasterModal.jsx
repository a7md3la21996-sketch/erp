// Bulk distribute modal for the Master Leads page. Takes a list of selected
// "families" (one phone per family) + lets the admin pick agent(s) to clone
// every selected family onto. Loops distributeLeadToAgents per family,
// caps concurrency so we don't overwhelm RLS.

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Check, AlertTriangle } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../components/ui';
import { distributeLeadToAgents } from '../../services/contactsService';
import { fetchTeamAgents } from '../../services/opportunitiesService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { reportError } from '../../utils/errorReporter';

const CONCURRENCY = 4; // be polite to RLS

export default function BulkDistributeMasterModal({ families, onClose, onSuccess, eligibleUserIds = null }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  // After-batch breakdown: how many failed for the same reason. Lets us
  // tell the user "30 already had a copy" vs a generic "30 failed", so
  // they can act on it (try a different agent set, etc).
  const [errorSummary, setErrorSummary] = useState(null);

  useEffect(() => {
    // Team-scoped: managers / leaders only see their team in this picker.
    // eligibleUserIds (if passed) further narrows by the parent page's scope.
    fetchTeamAgents({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id })
      .then(list => setAgents(list || []))
      .catch(() => {});
  }, [profile?.role, profile?.id, profile?.team_id]);

  // Active agents only — distributing onto an inactive account makes the
  // clone invisible until the account is reactivated. When eligibleUserIds
  // is passed, additionally narrow to that team scope.
  const eligible = useMemo(
    () => agents.filter(a =>
      a.status !== 'inactive'
      && (a.full_name_en || a.full_name_ar)
      && (!eligibleUserIds || eligibleUserIds.has(a.id))
    ),
    [agents, eligibleUserIds]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return eligible;
    const s = search.toLowerCase();
    return eligible.filter(a =>
      (a.full_name_en || '').toLowerCase().includes(s) ||
      (a.full_name_ar || '').toLowerCase().includes(s)
    );
  }, [eligible, search]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Pick the "origin" copy ID for each family — the earliest-created copy.
  // The list comes from master_leads_list which already orders copies ASC by
  // created_at, so copies[0] is the right one. Falls back to the first copy
  // we can find with an id.
  const familySources = useMemo(() => {
    return families.map(f => {
      const copies = Array.isArray(f.copies) ? f.copies : [];
      const origin = copies.find(c => c?.id) || null;
      return origin ? { phone: f.phone, name: f.primary_name, contactId: origin.id } : null;
    }).filter(Boolean);
  }, [families]);

  // Bucket common failure modes so we can tell the user *why* something
  // failed instead of a generic "X failed". The duplicate-prevent trigger
  // we just added throws unique_violation; RLS denials show up as
  // permission errors; everything else falls into "other".
  const classifyError = (err) => {
    const msg = String(err?.message || err?.toString?.() || '');
    if (/unique_violation|already has a non-deleted contact|duplicate key/i.test(msg)) return 'duplicate';
    if (/row-level security|rls|permission denied|not allowed/i.test(msg)) return 'permission';
    return 'other';
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.warning(isRTL ? 'اختر agent واحد على الأقل' : 'Select at least one agent');
      return;
    }
    if (familySources.length === 0) {
      toast.warning(isRTL ? 'لا يوجد عائلات للتوزيع' : 'No families to distribute');
      return;
    }
    const targets = [...selected];
    setSubmitting(true);
    setErrorSummary(null);
    setProgress({ done: 0, total: familySources.length, failed: 0 });

    let done = 0;
    let failed = 0;
    const errorBuckets = { duplicate: 0, permission: 0, other: 0 };
    const queue = [...familySources];
    const runWorker = async () => {
      while (queue.length) {
        const f = queue.shift();
        if (!f) return;
        try {
          await distributeLeadToAgents(f.contactId, targets);
        } catch (err) {
          failed++;
          errorBuckets[classifyError(err)]++;
          reportError('BulkDistributeMaster', 'distribute', err);
        }
        done++;
        setProgress({ done, total: familySources.length, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, familySources.length) }, () => runWorker()));

    setSubmitting(false);
    const okCount = done - failed;
    if (failed === 0) {
      toast.success(isRTL
        ? `تم توزيع ${okCount} عيلة على ${targets.length} agent`
        : `${okCount} families distributed to ${targets.length} agent(s)`);
      onSuccess?.({ done, failed });
      onClose();
    } else {
      // Keep the modal open so the user can read the breakdown and decide
      // whether to retry with different agents. onSuccess still fires so
      // the page refreshes the partial successes.
      setErrorSummary({ ok: okCount, failed, buckets: errorBuckets, targets: targets.length });
      onSuccess?.({ done, failed });
    }
  };

  const errorMessageBlock = () => {
    if (!errorSummary) return null;
    const { ok, failed, buckets, targets } = errorSummary;
    const lines = [];
    if (buckets.duplicate > 0) {
      lines.push(isRTL
        ? `• ${buckets.duplicate} السيلز عنده النسخة بالفعل (مفيش داعي تعيد توزيع نفس الرقم لنفس السيلز)`
        : `• ${buckets.duplicate} the agent already has a copy of this lead`);
    }
    if (buckets.permission > 0) {
      lines.push(isRTL
        ? `• ${buckets.permission} مرفوض لأسباب صلاحيات (RLS)`
        : `• ${buckets.permission} blocked by permissions (RLS)`);
    }
    if (buckets.other > 0) {
      lines.push(isRTL
        ? `• ${buckets.other} فشل بأسباب أخرى — راجع السجلات`
        : `• ${buckets.other} failed for other reasons — check logs`);
    }
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
        <div className="font-bold">
          {isRTL
            ? `نجح ${ok} عيلة، فشل ${failed} (لـ ${targets} agent)`
            : `${ok} succeeded, ${failed} failed (across ${targets} agents)`}
        </div>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    );
  };

  return (
    <Modal open onClose={submitting ? () => {} : onClose} title={isRTL ? 'توزيع جماعي' : 'Bulk Distribute'}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900 dark:text-blue-300">
              {isRTL ? `${familySources.length} عيلة محددة` : `${familySources.length} families selected`}
            </span>
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300/80">
            {isRTL
              ? 'هيتم إنشاء نسخة من كل عيلة لكل agent تختاره — الأصل يفضل عند المالك الحالي.'
              : 'A copy of each family will be cloned to every selected agent. Originals stay with current owners.'}
          </div>
        </div>

        {/* Agent picker */}
        <div className="relative">
          <Search size={14} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-content-muted dark:text-content-muted-dark`} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث عن agent...' : 'Search agents...'}
            className={isRTL ? 'pe-3 ps-9' : 'ps-9 pe-3'}
            disabled={submitting}
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto border border-edge dark:border-edge-dark rounded-lg">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لا يوجد agents' : 'No agents'}
            </div>
          ) : filtered.map(a => {
            const id = a.id;
            const isSel = selected.has(id);
            const name = isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={submitting}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-edge/40 dark:border-edge-dark/40 last:border-b-0 hover:bg-brand-500/5 cursor-pointer text-start ${isSel ? 'bg-brand-500/10' : 'bg-transparent'}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-brand-500 border-brand-500' : 'border-edge dark:border-edge-dark'}`}>
                  {isSel && <Check size={11} className="text-white" />}
                </span>
                <span className="text-content dark:text-content-dark">{name}</span>
              </button>
            );
          })}
        </div>

        {/* Post-batch error breakdown (only shown when something failed) */}
        {errorMessageBlock()}

        {/* Progress bar (visible during submit) */}
        {submitting && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-content-muted dark:text-content-muted-dark">
              <span>{isRTL ? 'جارٍ التوزيع...' : 'Distributing...'}</span>
              <span>{progress.done}/{progress.total}{progress.failed > 0 && ` (${progress.failed} ${isRTL ? 'فشل' : 'failed'})`}</span>
            </div>
            <div className="w-full h-1.5 bg-edge dark:bg-edge-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-[width] duration-200"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Warning for big batches */}
        {familySources.length > 50 && !submitting && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              {isRTL
                ? `أنت بتوزع ${familySources.length} عيلة × ${selected.size || '?'} agent = ${familySources.length * (selected.size || 0)} نسخة جديدة. تأكد قبل ما تكمل.`
                : `You are distributing ${familySources.length} families × ${selected.size || '?'} agents = ${familySources.length * (selected.size || 0)} new copies. Confirm before continuing.`}
            </span>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {errorSummary ? (isRTL ? 'إغلاق' : 'Close') : (isRTL ? 'إلغاء' : 'Cancel')}
        </Button>
        {!errorSummary && (
          <Button onClick={handleSubmit} disabled={submitting || selected.size === 0 || familySources.length === 0}>
            {submitting
              ? (isRTL ? 'جارٍ التوزيع...' : 'Distributing...')
              : (isRTL ? `وزع لـ ${selected.size} agent` : `Distribute to ${selected.size} agent(s)`)}
          </Button>
        )}
        {errorSummary && (
          <Button onClick={() => { setErrorSummary(null); setSelected(new Set()); }}>
            {isRTL ? 'حاول من جديد' : 'Try again'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
