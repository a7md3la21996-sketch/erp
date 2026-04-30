import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Check } from 'lucide-react';
import { Modal, ModalFooter, Button, Input } from '../../../components/ui';
import { bulkDistributeLeads } from '../../../services/contactsService';
import { fetchSalesAgents } from '../../../services/opportunitiesService';
import { useToast } from '../../../contexts/ToastContext';

export default function BulkDistributeModal({ contactIds, onClose, onSuccess }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('round_robin');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSalesAgents().then(list => {
      setAgents((list || []).filter(a => a.status !== 'inactive' && a.role === 'sales_agent'));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const s = search.toLowerCase();
    return agents.filter(a =>
      (a.full_name_en || '').toLowerCase().includes(s) ||
      (a.full_name_ar || '').toLowerCase().includes(s)
    );
  }, [agents, search]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Preview: how many leads each selected agent gets
  const preview = useMemo(() => {
    if (selected.size === 0 || !contactIds.length) return [];
    const selectedAgents = agents.filter(a => selected.has(a.id));
    if (method === 'round_robin') {
      const total = contactIds.length;
      const each = Math.floor(total / selectedAgents.length);
      const remainder = total % selectedAgents.length;
      return selectedAgents.map((a, i) => ({
        name: isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar),
        count: each + (i < remainder ? 1 : 0),
      }));
    }
    // Workload preview is approximate (full calc happens server-side)
    return selectedAgents.map(a => ({
      name: isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar),
      count: '~' + Math.floor(contactIds.length / selectedAgents.length),
    }));
  }, [selected, agents, method, contactIds, isRTL]);

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.warning(isRTL ? 'اختر agent واحد على الأقل' : 'Select at least one agent');
      return;
    }
    setSubmitting(true);
    try {
      const result = await bulkDistributeLeads(contactIds, [...selected], method);
      const msg = isRTL
        ? `تم توزيع ${result.applied} من ${contactIds.length} ليد${result.errors.length ? ` (${result.errors.length} فشل)` : ''}`
        : `Distributed ${result.applied} of ${contactIds.length} leads${result.errors.length ? `, ${result.errors.length} failed` : ''}`;
      toast.success(msg);
      onSuccess?.(result);
      onClose();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'فشل التوزيع' : 'Distribution failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isRTL ? `توزيع ${contactIds.length} ليد` : `Distribute ${contactIds.length} leads`}>
      <div className="space-y-4">
        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900 dark:text-blue-200">
              {isRTL ? `${contactIds.length} ليد محدد` : `${contactIds.length} selected leads`}
            </span>
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            {isRTL
              ? 'كل ليد هينقل لـ agent واحد من اللي اخترتهم. مفيش clones — الـ ownership بتتغير.'
              : 'Each lead transfers to one of the selected agents. No clones — ownership changes.'
            }
          </p>
        </div>

        {/* Method picker */}
        <div>
          <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-2">
            {isRTL ? 'طريقة التوزيع' : 'Distribution method'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('round_robin')}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${
                method === 'round_robin'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
              }`}
            >
              {isRTL ? 'متساوي (Round-Robin)' : 'Round-Robin'}
            </button>
            <button
              type="button"
              onClick={() => setMethod('workload')}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${
                method === 'workload'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
              }`}
            >
              {isRTL ? 'حسب الـ workload' : 'Workload-based'}
            </button>
          </div>
          <div className="text-[10px] text-content-muted dark:text-content-muted-dark mt-1">
            {method === 'round_robin'
              ? (isRTL ? 'كل agent ياخد عدد متساوي' : 'Each agent gets equal count')
              : (isRTL ? 'الـ agent عنده أقل ليدز active ياخد أكتر' : 'Agents with fewer active leads get more')
            }
          </div>
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
        <div className="border border-edge dark:border-edge-dark rounded-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-content-muted">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-content-muted">{isRTL ? 'لا توجد نتائج' : 'No results'}</div>
          ) : (
            <ul className="divide-y divide-edge/50 dark:divide-edge-dark/50">
              {filtered.map(a => {
                const isSelected = selected.has(a.id);
                const name = isRTL ? (a.full_name_ar || a.full_name_en) : (a.full_name_en || a.full_name_ar);
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => toggle(a.id)}
                      className={`w-full flex items-center gap-3 p-3 text-start ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-surface-bg dark:hover:bg-brand-500/[0.04]'
                      }`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-content dark:text-content-dark">{name}</div>
                        <div className="text-xs text-content-muted dark:text-content-muted-dark">{a.role}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-surface-bg dark:bg-surface-bg-dark rounded-lg p-3">
            <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-2">
              {isRTL ? 'معاينة التوزيع' : 'Distribution preview'}
            </div>
            <div className="space-y-1">
              {preview.map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-content dark:text-content-dark">
                  <span>{p.name}</span>
                  <span className="font-bold">{p.count} {isRTL ? 'ليد' : 'leads'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || selected.size === 0}>
          {submitting
            ? (isRTL ? 'جاري التوزيع...' : 'Distributing...')
            : (isRTL ? `وزع على ${selected.size} agent` : `Distribute to ${selected.size}`)
          }
        </Button>
      </ModalFooter>
    </Modal>
  );
}
