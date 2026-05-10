// Bulk distribute modal for the Master Leads page. Takes a list of selected
// "families" (one phone per family) + lets the admin pick agent(s) to clone
// every selected family onto. Loops distributeLeadToAgents per family,
// caps concurrency so we don't overwhelm RLS.

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Check, AlertTriangle } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../components/ui';
import { distributeLeadToAgents } from '../../services/contactsService';
import { fetchSalesAgents } from '../../services/opportunitiesService';
import { useToast } from '../../contexts/ToastContext';
import { reportError } from '../../utils/errorReporter';

const CONCURRENCY = 4; // be polite to RLS

export default function BulkDistributeMasterModal({ families, onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });

  useEffect(() => {
    fetchSalesAgents().then(list => setAgents(list || [])).catch(() => {});
  }, []);

  // Active agents only — distributing onto an inactive account makes the
  // clone invisible until the account is reactivated.
  const eligible = useMemo(
    () => agents.filter(a => a.status !== 'inactive' && (a.full_name_en || a.full_name_ar)),
    [agents]
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
    setProgress({ done: 0, total: familySources.length, failed: 0 });

    let done = 0;
    let failed = 0;
    const queue = [...familySources];
    const runWorker = async () => {
      while (queue.length) {
        const f = queue.shift();
        if (!f) return;
        try {
          await distributeLeadToAgents(f.contactId, targets);
        } catch (err) {
          failed++;
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
    } else {
      toast.error(isRTL
        ? `نجح ${okCount}، فشل ${failed} — راجع السجلات`
        : `${okCount} succeeded, ${failed} failed — check logs`);
    }
    onSuccess?.({ done, failed });
    onClose();
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
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || selected.size === 0 || familySources.length === 0}>
          {submitting
            ? (isRTL ? 'جارٍ التوزيع...' : 'Distributing...')
            : (isRTL ? `وزع لـ ${selected.size} agent` : `Distribute to ${selected.size} agent(s)`)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
