import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, X, Check } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../../components/ui';
import { distributeLeadToAgents } from '../../../services/contactsService';
import { fetchSalesAgents } from '../../../services/opportunitiesService';
import { useToast } from '../../../contexts/ToastContext';

export default function DistributeLeadModal({ contact, onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSalesAgents().then(list => {
      setAgents(list);
      setLoading(false);
    });
  }, []);

  const currentOwnerId = contact?.assigned_to;
  const currentOwnerName = contact?.assigned_to_name;

  // Eligible agents: not the current owner
  const eligible = useMemo(() => {
    return agents.filter(a => a.id !== currentOwnerId);
  }, [agents, currentOwnerId]);

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

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.warning(isRTL ? 'اختر agent واحد على الأقل' : 'Select at least one agent');
      return;
    }
    setSubmitting(true);
    try {
      const result = await distributeLeadToAgents(contact.id, [...selected]);
      const okMsg = isRTL
        ? `تم إنشاء ${result.created.length} record${result.errors.length ? ` (${result.errors.length} فشل)` : ''}`
        : `Created ${result.created.length} record(s)${result.errors.length ? `, ${result.errors.length} failed` : ''}`;
      toast.success(okMsg);
      onSuccess?.(result);
      onClose();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشل التوزيع' : 'Distribution failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isRTL ? 'توزيع الليد على agents' : 'Distribute Lead'} size="md">
      <div className="space-y-4">
        {/* Lead summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900 dark:text-blue-300">
              {isRTL ? 'الليد الحالي' : 'Current Lead'}
            </span>
          </div>
          <div className="text-blue-800 dark:text-blue-200">
            {contact?.full_name} • <span dir="ltr">{contact?.phone}</span>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {isRTL ? 'المالك الحالي:' : 'Current owner:'} <span className="font-medium">{currentOwnerName || '—'}</span>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-xs">
          <p className="text-yellow-900 dark:text-yellow-200 leading-relaxed">
            {isRTL
              ? '⚠️ هيتعمل record جديد منفصل لكل agent مختار. كل واحد هيشتغل بشكل مستقل، والـ commission تروح للي يقفل البيعة.'
              : '⚠️ A new separate record will be created for each selected agent. They\'ll work independently. Commission goes to whoever closes the deal.'
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
                const isSelected = selected.has(a.id);
                const name = isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      className={`w-full flex items-center gap-3 p-3 text-start transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
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

        {/* Selection summary */}
        {selected.size > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isRTL ? `تم اختيار ${selected.size} agent` : `${selected.size} agent(s) selected`}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || selected.size === 0}>
          {submitting
            ? (isRTL ? 'جاري الإنشاء...' : 'Creating...')
            : (isRTL ? `إنشاء ${selected.size} سجل` : `Create ${selected.size} record(s)`)
          }
        </Button>
      </ModalFooter>
    </Modal>
  );
}
