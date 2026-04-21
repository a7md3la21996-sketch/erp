import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { X } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import { useEscClose, SOURCE_LABELS, SOURCE_EN, SOURCE_PLATFORM, PLATFORM_LABELS, AD_SOURCES, COUNTRY_CODES, getCountryFromPhone, getPhoneInfo, validatePhone, normalizePhone } from './constants';
import { useFocusTrap } from '../../../utils/hooks';

const getFullPhone = (phone, code) => {
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('00')) return '+' + phone.slice(2);
  // Respect the user-selected country code: strip leading 0 (local-format prefix) and prepend code
  if (phone.startsWith('0')) return code + phone.slice(1);
  return code + phone;
};

export default function EditContactModal({ contact, onClose, onSave, userRole, campaigns = [] }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);

  // Extract local phone from stored full phone
  const initPhone = (p) => {
    if (!p) return '';
    const cc = getCountryFromPhone(p);
    if (cc) return p.replace(cc.code, '');
    return p;
  };
  const initCode = (p) => {
    if (!p) return '+20';
    const cc = getCountryFromPhone(p);
    return cc ? cc.code : '+20';
  };

  const [form, setForm] = useState({
    prefix: contact.prefix || '',
    full_name: contact.full_name || '',
    phone: initPhone(contact.phone),
    phone2: initPhone(contact.phone2),
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
    countryCode: initCode(contact.phone),
    countryCode2: initCode(contact.phone2),
    platform: SOURCE_PLATFORM[contact.source] || 'other',
  });
  const [extraPhones, setExtraPhones] = useState(() => (contact.extra_phones || []).map(p => initPhone(p)));
  const [extraCodes, setExtraCodes] = useState(() => (contact.extra_phones || []).map(p => initCode(p)));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // sync guard against double-submit
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isSalesType = ['lead','client'].includes(form.contact_type);
  const isSalesDept = form.department === 'sales';
  const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const handlePhoneChange = (val, field, codeField) => {
    set(field, val);
    if (val.startsWith('0')) {
      const detected = getCountryFromPhone(normalizePhone(val));
      if (detected) set(codeField, detected.code);
    }
  };

  const handleSourceChange = (src) => {
    set('source', src);
    set('platform', SOURCE_PLATFORM[src] || 'other');
  };

  const handleSave = async () => {
    if (savingRef.current) return; // prevent double-submit
    const fullPhone = getFullPhone(form.phone, form.countryCode);
    if (!validatePhone(fullPhone)) { toast.warning(isRTL ? 'رقم الهاتف غير صحيح' : 'Invalid phone number'); return; }
    if (form.email && !emailValid) { toast.warning(isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email'); return; }
    if (form.phone2) {
      const fullPhone2 = getFullPhone(form.phone2, form.countryCode2);
      if (!validatePhone(fullPhone2)) { toast.warning(isRTL ? 'رقم الهاتف الثاني غير صحيح' : 'Invalid secondary phone number'); return; }
    }
    const invalidExtra = extraPhones.find((p, i) => p && !validatePhone(getFullPhone(p, extraCodes[i])));
    if (invalidExtra) { toast.warning(isRTL ? 'رقم إضافي غير صحيح' : 'Invalid extra phone number'); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const { countryCode, countryCode2, ...formData } = form;
      const validExtras = extraPhones.reduce((acc, p, idx) => {
        if (p && validatePhone(getFullPhone(p, extraCodes[idx]))) acc.push(getFullPhone(p, extraCodes[idx]));
        return acc;
      }, []);
      await onSave({ ...contact, ...formData,
        phone: fullPhone,
        phone2: getFullPhone(form.phone2, countryCode2),
        extra_phones: validExtras.length > 0 ? validExtras : null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      });
      toast.success(isRTL ? 'تم حفظ التعديلات' : 'Changes saved');
      onClose();
    } catch (err) {
      toast.error((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
      setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[950] flex items-center justify-center p-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-contact-title" className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[580px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center shrink-0">
          <div>
            <h2 id="edit-contact-title" className="m-0 text-content dark:text-content-dark text-[17px] font-bold">{isRTL ? 'تعديل بيانات العميل' : 'Edit Lead'}</h2>
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
              <input className="w-full rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-sm px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30" dir="ltr" style={{ unicodeBidi: 'plaintext', textAlign: 'left' }} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder={isRTL ? 'الاسم الكامل...' : 'Full name...'} />
            </div>
          </div>

          {/* النوع والقسم */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النوع' : 'Type'}</label>
              <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
                <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
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

          {/* الهاتف */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span>
                {(() => { const fp = getFullPhone(form.phone, form.countryCode); if (!fp) return null; if (!validatePhone(fp)) return <span className="text-xs text-orange-500 ms-1">{isRTL ? '⚠️ رقم غير صحيح' : '⚠️ Invalid'}</span>; const info = getPhoneInfo(fp); return info ? <span className="text-xs text-emerald-500 ms-1">{info.flag} {info.country}</span> : null; })()}
              </label>
              <div className="flex gap-1.5">
                <Select value={form.countryCode} onChange={e => set('countryCode', e.target.value)} className="!w-[90px] shrink-0">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.flag}</option>)}
                </Select>
                <Input value={form.phone} onChange={e => handlePhoneChange(e.target.value, 'phone', 'countryCode')} placeholder="10xxxxxxxx" className="flex-1" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'هاتف 2' : 'Phone 2'}
                {(() => { const fp = getFullPhone(form.phone2, form.countryCode2); if (!fp) return null; if (!validatePhone(fp)) return <span className="text-xs text-orange-500 ms-1">{isRTL ? '⚠️ رقم غير صحيح' : '⚠️ Invalid'}</span>; const info = getPhoneInfo(fp); return info ? <span className="text-xs text-emerald-500 ms-1">{info.flag} {info.country}</span> : null; })()}
              </label>
              <div className="flex gap-1.5">
                <Select value={form.countryCode2} onChange={e => set('countryCode2', e.target.value)} className="!w-[90px] shrink-0">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.flag}</option>)}
                </Select>
                <Input value={form.phone2} onChange={e => handlePhoneChange(e.target.value, 'phone2', 'countryCode2')} placeholder="11xxxxxxxx" className="flex-1" />
              </div>
            </div>
          </div>

          {/* أرقام إضافية */}
          {extraPhones.length > 0 && extraPhones.map((ph, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <Select value={extraCodes[i] || '+20'} onChange={e => { const nc = [...extraCodes]; nc[i] = e.target.value; setExtraCodes(nc); }} className="!w-[90px] shrink-0">
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.flag}</option>)}
              </Select>
              <div className="flex-1">
                <Input value={ph} onChange={e => { const np = [...extraPhones]; np[i] = e.target.value; setExtraPhones(np); }} placeholder="10xxxxxxxx" />
                {ph && (() => { const fp = getFullPhone(ph, extraCodes[i]); if (!validatePhone(fp)) return <span className="text-[10px] text-orange-500 mt-0.5 block">{isRTL ? '⚠️ رقم غير صحيح' : '⚠️ Invalid'}</span>; const info = getPhoneInfo(fp); return info ? <span className="text-[10px] text-emerald-500 mt-0.5 block">{info.flag} {info.country}</span> : null; })()}
              </div>
              <button onClick={() => { setExtraPhones(extraPhones.filter((_, j) => j !== i)); setExtraCodes(extraCodes.filter((_, j) => j !== i)); }}
                className="mt-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 cursor-pointer text-sm leading-none shrink-0">×</button>
            </div>
          ))}
          <button onClick={() => { setExtraPhones([...extraPhones, '']); setExtraCodes([...extraCodes, '+20']); }}
            className="text-xs text-brand-500 bg-brand-500/[0.08] border border-brand-500/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-brand-500/[0.15] transition-colors w-fit">
            + {isRTL ? 'إضافة رقم' : 'Add Phone'}
          </button>

          {/* الإيميل */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
            {form.email && !emailValid && <span className="text-red-500 text-[10px] mt-0.5">{isRTL ? 'بريد إلكتروني غير صحيح' : 'Invalid email format'}</span>}
          </div>

          {/* الشركة والمسمى — مخفية لقسم المبيعات */}
          {!isSalesDept && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الشركة' : 'Company'}</label>
                <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
                <Input value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} />
              </div>
            </div>
          )}

          {/* المصدر والمنصة — للـ sales types فقط */}
          {isSalesType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => handleSourceChange(e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المنصة' : 'Platform'}</label>
                <Input value={PLATFORM_LABELS[form.platform]?.[isRTL ? 'ar' : 'en'] || form.platform} readOnly className="!bg-gray-50 dark:!bg-gray-800/50 !cursor-default" />
              </div>
            </div>
          )}

          {/* الكامبين */}
          {isSalesType && (
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الحملة' : 'Campaign'}</label>
              <div className="relative">
                <Input
                  value={form.campaign_name}
                  onChange={e => set('campaign_name', e.target.value)}
                  placeholder={isRTL ? 'ابحث أو اكتب اسم الحملة...' : 'Search or type campaign...'}
                  list="campaign-options"
                />
                <datalist id="campaign-options">
                  {(campaigns || []).map(c => (
                    <option key={c.id} value={isRTL ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {/* الميزانية — للـ sales types فقط */}
          {isSalesType && (
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الميزانية (من - إلى)' : 'Budget (min - max)'}</label>
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder={isRTL ? 'من' : 'Min'} type="number" />
                <Input value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder={isRTL ? 'إلى' : 'Max'} type="number" />
              </div>
            </div>
          )}

          {/* الجنس والجنسية — مخفية لقسم المبيعات */}
          {!isSalesDept && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          )}

          {/* ملاحظات — only admin/operations can edit */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {isRTL ? 'ملاحظات' : 'Notes'}
              {userRole !== 'admin' && userRole !== 'operations' && (
                <span className="text-[10px] text-orange-500 ms-1">{isRTL ? '(للقراءة فقط)' : '(read-only)'}</span>
              )}
            </label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder={isRTL ? 'أي ملاحظات...' : 'Any notes...'}
              disabled={userRole !== 'admin' && userRole !== 'operations'}
              className={userRole !== 'admin' && userRole !== 'operations' ? '!bg-gray-50 dark:!bg-gray-800/50 !cursor-not-allowed' : ''}
            />
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
