import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, AlertTriangle, X } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../../components/ui';
import { fetchContactsByPhone } from '../../../services/contactsService';
import supabase from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

const STATUS_COLORS = {
  new: '#3B82F6',
  contacted: '#F59E0B',
  following: '#10B981',
  has_opportunity: '#8B5CF6',
  disqualified: '#6B7280',
  inactive: '#9CA3AF',
};

export default function PullOtherLeadsModal({ contact, onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [others, setOthers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!contact?.phone) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchContactsByPhone(contact.phone);
        if (cancelled) return;
        const otherActive = all.filter(c =>
          c.id !== contact.id &&
          !c.is_deleted &&
          c.contact_status !== 'disqualified'
        );
        setOthers(otherActive);
        // Default: select all
        setSelected(new Set(otherActive.map(c => c.id)));
        setReason(isRTL
          ? `تم إغلاق الصفقة بواسطة ${contact.assigned_to_name || ''}`
          : `Deal closed by ${contact.assigned_to_name || 'another agent'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contact?.id, contact?.phone, isRTL]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.warning(isRTL ? 'اختر record واحد على الأقل' : 'Select at least one record');
      return;
    }
    setSubmitting(true);
    try {
      const toUpdate = others.filter(c => selected.has(c.id));
      const results = await Promise.allSettled(toUpdate.map(c =>
        supabase.from('contacts').update({
          contact_status: 'disqualified',
          disqualify_reason: 'won_by_other_agent',
          disqualify_note: reason,
          agent_statuses: { ...(c.agent_statuses || {}), [c.assigned_to_name]: 'disqualified' },
        }).eq('id', c.id)
      ));
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      toast.success(isRTL
        ? `تم سحب ${ok} ليد${fail ? ` (${fail} فشل)` : ''}`
        : `Pulled ${ok} lead(s)${fail ? `, ${fail} failed` : ''}`);
      onSuccess?.({ ok, fail });
      onClose();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشلت العملية' : 'Operation failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isRTL ? 'سحب الليد من باقي الـ agents' : 'Pull Leads from Other Agents'} size="md">
      <div className="space-y-4">
        {/* Won banner */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-3">
          <Award className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-green-900 dark:text-green-300 mb-0.5">
              {isRTL ? 'الصفقة الفائزة' : 'Winning Deal'}
            </div>
            <div className="text-green-800 dark:text-green-200">
              {contact?.full_name} • <span dir="ltr">{contact?.phone}</span>
            </div>
            <div className="text-xs text-green-700 dark:text-green-400 mt-0.5">
              {isRTL ? 'الـ agent الفائز:' : 'Winning agent:'} <span className="font-medium">{contact?.assigned_to_name || '—'}</span>
            </div>
          </div>
        </div>

        {/* Others list */}
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : others.length === 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center text-sm text-blue-800 dark:text-blue-200">
            {isRTL ? 'لا يوجد records أخرى على هذا الفون' : 'No other active records on this phone'}
          </div>
        ) : (
          <>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-900 dark:text-yellow-200 leading-relaxed">
                {isRTL
                  ? `الـ records المختارة هتتـ disqualify بـ reason "won_by_other_agent". الـ agents هيلاحظوا التغيير في الـ pipeline بتاعهم.`
                  : `Selected records will be marked disqualified with reason "won_by_other_agent". Agents will notice in their pipelines.`
                }
              </p>
            </div>

            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isRTL ? `اختر السجلات اللي هتتسحب (${others.length})` : `Select records to pull (${others.length})`}
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-72 overflow-y-auto">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {others.map(c => {
                  const isSelected = selected.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`w-full flex items-center gap-3 p-3 text-start ${isSelected ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {c.assigned_to_name || (isRTL ? 'غير معين' : 'Unassigned')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {c.contact_number || c.id.slice(0, 8)} • {isRTL ? 'منذ' : 'since'}{' '}
                            {new Date(c.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                          style={{ background: STATUS_COLORS[c.contact_status] || '#6B7280' }}
                        >
                          {c.contact_status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 block">
                {isRTL ? 'سبب السحب (يظهر للـ agent)' : 'Pull reason (shown to agent)'}
              </label>
              <Input value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        {others.length > 0 && (
          <Button onClick={handleSubmit} disabled={submitting || selected.size === 0} className="bg-red-600 hover:bg-red-700">
            {submitting
              ? (isRTL ? 'جاري السحب...' : 'Pulling...')
              : (isRTL ? `سحب ${selected.size} ليد` : `Pull ${selected.size} lead(s)`)
            }
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
