import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { X } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import { useEscClose, SOURCE_LABELS, SOURCE_EN } from './constants';

export default function EditContactModal({ contact, onClose, onSave }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const [form, setForm] = useState({
    prefix: contact.prefix || '',
    full_name: contact.full_name || '',
    phone: contact.phone || '',
    phone2: contact.phone2 || '',
    email: contact.email || '',
    contact_type: contact.contact_type || 'lead',
    source: contact.source || 'facebook',
    campaign_name: contact.campaign_name || '',
    budget_min: contact.budget_min || '',
    budget_max: contact.budget_max || '',
    preferred_location: contact.preferred_location || '',
    interested_in_type: contact.interested_in_type || 'residential',
    notes: contact.notes || '',
    department: contact.department || 'sales',
    gender: contact.gender || '',
    nationality: contact.nationality || '',
    birth_date: contact.birth_date || '',
    company: contact.company || '',
    job_title: contact.job_title || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isSalesType = ['lead','cold','client'].includes(form.contact_type);

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.warning(isRTL ? 'الاسم مطلوب' : 'Name is required'); return; }
    setSaving(true);
    try {
      await onSave({ ...contact, ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      });
      onClose();
    } catch (err) {
      toast.error((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
      setSaving(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[950] flex items-center justify-center p-5">
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[580px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-content dark:text-content-dark text-[17px] font-bold">{isRTL ? 'تعديل بيانات جهة الاتصال' : 'Edit Contact'}</h2>
            <p className="mt-[3px] mb-0 text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">{contact.full_name}</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 flex flex-col gap-3.5">

          {/* الاسم والـ prefix */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
            <div className="grid grid-cols-[120px_1fr] gap-2.5">
              <Select value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Dr.">Dr.</option>
                <option value="Eng.">Eng.</option>
                <option value="أستاذ">أستاذ</option>
              </Select>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder={isRTL ? 'الاسم الكامل...' : 'Full name...'} />
            </div>
          </div>

          {/* النوع والقسم */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النوع' : 'Type'}</label>
              <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
                <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
                <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
                <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
                <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
                <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
                <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
                <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'القسم' : 'Department'}</label>
              <Select value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
              </Select>
            </div>
          </div>

          {/* الهاتف والإيميل */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span></label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010xxxxxxxx" />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'هاتف 2' : 'Phone 2'}</label>
              <Input value={form.phone2} onChange={e => set('phone2', e.target.value)} placeholder="011xxxxxxxx" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
          </div>

          {/* الشركة والمسمى */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الشركة' : 'Company'}</label>
              <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
              <Input value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} />
            </div>
          </div>

          {/* المصدر — للـ sales types فقط */}
          {isSalesType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الميزانية (من - إلى)' : 'Budget (min - max)'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder={isRTL ? 'من' : 'Min'} type="number" />
                  <Input value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder={isRTL ? 'إلى' : 'Max'} type="number" />
                </div>
              </div>
            </div>
          )}

          {/* الجنس والجنسية */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الجنس' : 'Gender'}</label>
              <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <Select value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="egyptian">{isRTL ? 'مصري' : 'Egyptian'}</option>
                <option value="saudi">{isRTL ? 'سعودي' : 'Saudi'}</option>
                <option value="emirati">{isRTL ? 'إماراتي' : 'Emirati'}</option>
                <option value="kuwaiti">{isRTL ? 'كويتي' : 'Kuwaiti'}</option>
                <option value="qatari">{isRTL ? 'قطري' : 'Qatari'}</option>
                <option value="libyan">{isRTL ? 'ليبي' : 'Libyan'}</option>
                <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
              </Select>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={isRTL ? 'أي ملاحظات...' : 'Any notes...'} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-edge dark:border-edge-dark flex justify-end gap-2.5 shrink-0">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isRTL ? 'جارى الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}
          </Button>
        </div>
      </div>
    </div>
  );
}
