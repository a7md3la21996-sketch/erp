import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Search, Check, ArrowRight } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../../components/ui';
import { handOffLead } from '../../../services/contactsService';
import { fetchSalesAgents } from '../../../services/opportunitiesService';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Hand Off Modal — transfers a lead's ownership to another agent.
 * Unlike Distribute (which clones), this MOVES the same record so the
 * current owner loses it from their pipeline.
 */
export default function HandOffLeadModal({ contact, onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSalesAgents().then(list => {
      // Only active sales agents — managers can't hand off to inactive users
      setAgents((list || []).filter(a => a.status !== 'inactive' || a.id === contact?.assigned_to));
      setLoading(false);
    });
  }, [contact?.assigned_to]);

  const currentOwnerId = contact?.assigned_to;
  const currentOwnerName = contact?.assigned_to_name;

  // Eligible: not the current owner, active sales agents only
  const eligible = useMemo(() => {
    return agents.filter(a => a.id !== currentOwnerId && a.role === 'sales_agent');
  }, [agents, currentOwnerId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return eligible;
    const s = search.toLowerCase();
    return eligible.filter(a =>
      (a.full_name_en || '').toLowerCase().includes(s) ||
      (a.full_name_ar || '').toLowerCase().includes(s)
    );
  }, [eligible, search]);

  const handleSubmit = async () => {
    if (!selected) {
      toast.warning(isRTL ? 'اختر agent' : 'Select an agent');
      return;
    }
    setSubmitting(true);
    try {
      const byName = profile?.full_name_en || profile?.full_name_ar || '';
      await handOffLead(contact.id, selected.id, { assignedByName: byName });
      const targetDisplay = isRTL
        ? (selected.full_name_ar || selected.full_name_en)
        : (selected.full_name_en || selected.full_name_ar);
      toast.success(isRTL
        ? `تم تسليم الليد لـ ${targetDisplay}`
        : `Lead handed off to ${targetDisplay}`);
      onSuccess?.(selected);
      onClose();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشل التسليم' : 'Hand off failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isRTL ? 'تسليم الليد' : 'Hand Off Lead'} size="md">
      <div className="space-y-4">
        {/* Lead summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">{isRTL ? 'الليد' : 'Lead'}</div>
          <div className="font-medium text-blue-900 dark:text-blue-200">
            {contact?.full_name} • <span dir="ltr">{contact?.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mt-2">
            <span className="font-medium">{currentOwnerName || (isRTL ? 'غير معين' : 'Unassigned')}</span>
            <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
            <span className="font-medium">
              {selected
                ? (isRTL ? (selected.full_name_ar || selected.full_name_en) : (selected.full_name_en || selected.full_name_ar))
                : (isRTL ? '?' : '?')}
            </span>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
          <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
            {isRTL
              ? '⚠️ بعد التسليم، الليد يختفي من pipeline بتاعك ويظهر عند الـ agent المختار. الـ history (activities/tasks) ينتقل معاه.'
              : '⚠️ After hand off, this lead leaves your pipeline and goes to the selected agent. History (activities/tasks) transfers with it.'
            }
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث عن agent...' : 'Search agent...'}
            className={isRTL ? 'pe-9' : 'ps-9'}
            autoFocus
          />
        </div>

        {/* Agent picker */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">{isRTL ? 'لا توجد نتائج' : 'No results'}</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(a => {
                const isSelected = selected?.id === a.id;
                const name = isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(a)}
                      className={`w-full flex items-center gap-3 p-3 text-start transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</div>
                        <div className="text-xs text-gray-500">{a.role}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || !selected}>
          <Send className="w-3 h-3" />
          {submitting
            ? (isRTL ? 'جاري التسليم...' : 'Handing off...')
            : (isRTL ? 'تسليم الليد' : 'Hand Off Lead')
          }
        </Button>
      </ModalFooter>
    </Modal>
  );
}
