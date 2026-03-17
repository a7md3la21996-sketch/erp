import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { X, Loader2 } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui';
import { TEMP_CONFIG, PRIORITY_CONFIG, addStageHistory } from './constants';
import { getDeptStages } from '../contacts/constants';

export default function EditOpportunityModal({ opp, agents, projects, profile, onClose, onSave, onEditStageLost }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const toast = useToast();

  const [form, setForm] = useState({
    budget: opp.budget || '',
    temperature: opp.temperature || 'cold',
    priority: opp.priority || 'medium',
    assigned_to: opp.assigned_to || '',
    project_id: opp.project_id || '',
    notes: opp.notes || '',
    stage: opp.stage || 'qualification',
    expected_close_date: opp.expected_close_date || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ESC close
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
  };

  const handleSave = async () => {
    setSaving(true);
    const stageChanged = form.stage !== opp.stage;
    if (stageChanged) {
      if (form.stage === 'closed_lost') {
        setSaving(false);
        onEditStageLost(opp.id, form);
        return;
      }
      addStageHistory(opp.id, opp.stage, form.stage);
    }
    const assignmentChanged = form.assigned_to !== (opp.assigned_to || '');
    const updates = {
      budget: Number(form.budget) || 0,
      temperature: form.temperature,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      ...(assignmentChanged ? { assigned_by: profile?.id || null } : {}),
      project_id: form.project_id || null,
      notes: form.notes,
      expected_close_date: form.expected_close_date || null,
      ...(stageChanged ? { stage: form.stage, stage_changed_at: new Date().toISOString() } : {}),
    };
    try {
      await onSave(opp.id, updates);
      toast.success(isRTL ? 'تم حفظ التعديلات' : 'Changes saved');
      onClose();
    } catch (err) {
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const stages = getDeptStages(opp.contacts?.department || 'sales');

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 bg-black/50 z-[950] flex items-center justify-center p-5"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[480px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge dark:border-edge-dark shrink-0">
          <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'تعديل الفرصة' : 'Edit Opportunity'}
          </h3>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-lg hover:bg-brand-500/10">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الميزانية' : 'Budget'}</label>
              <Input type="number" min="0" value={form.budget} onChange={e => set('budget', Math.max(0, e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المسؤول' : 'Agent'}</label>
              <Select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المرحلة' : 'Stage'}</label>
              <Select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {stages.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الإغلاق المتوقع' : 'Expected Close'}</label>
              <Input type="date" value={form.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المشروع' : 'Project'}</label>
            <Select value={form.project_id} onChange={e => set('project_id', e.target.value)}>
              <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الحرارة' : 'Temperature'}</label>
            <div className="flex gap-1.5">
              {Object.entries(TEMP_CONFIG).map(([k, v]) => {
                const isActive = form.temperature === k;
                return (
                  <button key={k} onClick={() => set('temperature', k)}
                    className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                    style={isActive ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                  >{isRTL ? v.label_ar : v.label_en}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الأولوية' : 'Priority'}</label>
            <div className="flex gap-1.5">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
                const isActive = form.priority === k;
                return (
                  <button key={k} onClick={() => set('priority', k)}
                    className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                    style={isActive ? { borderColor: v.color, background: `${v.color}18`, color: v.color } : {}}
                  >{isRTL ? v.label_ar : v.label_en}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-edge dark:border-edge-dark shrink-0">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
