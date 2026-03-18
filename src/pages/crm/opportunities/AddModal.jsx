import { useState } from "react";
import { Loader2, AlertTriangle } from 'lucide-react';
import { createOpportunity } from '../../../services/opportunitiesService';
import { getDeptStages } from '../contacts/constants';
import { TEMP_CONFIG, PRIORITY_CONFIG } from './constants';
import ContactSearch from './ContactSearch';
import { Button, Input, Select, Textarea, Modal, ModalFooter } from '../../../components/ui';

export default function AddModal({ isRTL, lang, onClose, onSave, agents, projects, existingOpps = [], currentUserId, currentUserName }) {
  const [form, setForm] = useState({ contact: null, budget: '', assigned_to: '', temperature: 'hot', priority: 'medium', stage: 'qualification', project_id: '', notes: '', expected_close_date: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const f = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };
  const contactDept = form.contact?.department || 'sales';
  const stageConfig = getDeptStages(contactDept);

  const handleSave = async () => {
    const errs = {};
    if (!form.contact) errs.contact = isRTL ? 'جهة الاتصال مطلوبة' : 'Contact is required';
    if (form.budget && (isNaN(Number(form.budget)) || Number(form.budget) < 0)) errs.budget = isRTL ? 'الميزانية يجب أن تكون رقم موجب' : 'Budget must be a positive number';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    const payload = {
      contact_id: form.contact.id,
      budget: Number(form.budget) || 0,
      assigned_to: form.assigned_to || null,
      assigned_by: currentUserId || null,
      created_by: currentUserId || null,
      created_by_name: currentUserName || null,
      temperature: form.temperature,
      priority: form.priority,
      stage: form.stage,
      project_id: form.project_id || null,
      notes: form.notes,
      expected_close_date: form.expected_close_date || null,
    };
    const result = await createOpportunity(payload);
    // Inject joined data so cards render names immediately
    if (!result.contacts && form.contact) {
      result.contacts = { id: form.contact.id, full_name: form.contact.full_name, phone: form.contact.phone, email: form.contact.email, company: form.contact.company, contact_type: form.contact.contact_type, department: form.contact.department };
    }
    if (!result.projects && form.project_id) {
      const proj = projects.find(p => p.id === form.project_id);
      if (proj) result.projects = { id: proj.id, name_ar: proj.name_ar, name_en: proj.name_en };
    }
    if (!result.users && form.assigned_to) {
      const agent = agents.find(a => a.id === form.assigned_to);
      if (agent) result.users = { id: agent.id, full_name_ar: agent.full_name_ar, full_name_en: agent.full_name_en };
    }
    onSave(result);
    setSaving(false);
  };

  return (
    <Modal open={true} onClose={onClose} title={isRTL ? 'إضافة فرصة جديدة' : 'Add New Opportunity'} width="max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 modal-grid">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'جهة الاتصال *' : 'Contact *'}
          </label>
          <ContactSearch isRTL={isRTL} value={form.contact} onSelect={c => { f('contact', c); if (c) { const stages = getDeptStages(c.department || 'sales'); f('stage', stages[0]?.id || 'qualification'); } }} />
          {errors.contact && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.contact}</span>}
          {form.contact && existingOpps.some(o => o.contact_id === form.contact.id) && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
              <AlertTriangle size={12} />
              {isRTL ? 'تنبيه: يوجد فرصة أخرى لنفس العميل' : 'Warning: This contact already has an opportunity'}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الميزانية' : 'Budget'}
          </label>
          <Input type="number" min="0" value={form.budget} onChange={e => f('budget', Math.max(0, e.target.value))} style={errors.budget ? { border: '1.5px solid #ef4444' } : {}} />
          {errors.budget && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.budget}</span>}
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المسؤول' : 'Agent'}
          </label>
          <Select value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
            <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
            {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المشروع' : 'Project'}
          </label>
          <Select value={form.project_id} onChange={e => f('project_id', e.target.value)}>
            <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المرحلة' : 'Stage'}
          </label>
          <Select value={form.stage} onChange={e => f('stage', e.target.value)}>
            {stageConfig.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'تاريخ الإغلاق المتوقع' : 'Expected Close'}
          </label>
          <Input type="date" value={form.expected_close_date} onChange={e => f('expected_close_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الحرارة' : 'Temperature'}
          </label>
          <div className="flex gap-1.5">
            {Object.entries(TEMP_CONFIG).map(([k, v]) => {
              const isActive = form.temperature === k;
              return (
                <button
                  key={k}
                  onClick={() => f('temperature', k)}
                  className={`flex-1 py-[7px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${
                    isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'
                  }`}
                  style={isActive ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                >
                  {isRTL ? v.label_ar : v.label_en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الأولوية' : 'Priority'}
          </label>
          <div className="flex gap-1.5">
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
              const isActive = form.priority === k;
              return (
                <button
                  key={k}
                  onClick={() => f('priority', k)}
                  className={`flex-1 py-[7px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${
                    isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'
                  }`}
                  style={isActive ? { borderColor: v.color, background: `${v.color}18`, color: v.color } : {}}
                >
                  {isRTL ? v.label_ar : v.label_en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'ملاحظات' : 'Notes'}
          </label>
          <Textarea value={form.notes} onChange={e => f('notes', e.target.value)} />
        </div>
      </div>
      <ModalFooter>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!form.contact || saving}
          className="gap-1.5"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
        <Button variant="secondary" size="md" onClick={onClose}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
