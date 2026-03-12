import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { X } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN,
  validatePhone, getPhoneInfo, normalizePhone,
  COUNTRY_CODES, getCountryFromPhone,
} from './constants';

export default function AddContactModal({ onClose, onSave, checkDup, onOpenOpportunity }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const dupTimer = useRef(null);
  const [step, setStep] = useState(1);
  const DEPT_TYPES = {
    sales: ['lead','cold','client','developer','partner'],
    hr: ['applicant'],
    finance: ['supplier'],
    marketing: ['lead','cold'],
    operations: ['partner','supplier'],
  };
  const [form, setForm] = useState({
    prefix: '', full_name: '', phone: '', phone2: '', email: '',
    contact_type: '', source: 'facebook', campaign_name: '',
    budget_min: '', budget_max: '', preferred_location: '',
    interested_in_type: '', notes: '', department: '',
    gender: '', nationality: '', birth_date: '', company: '', job_title: '',
    countryCode: '+20',
  });
  const [dupWarning, setDupWarning] = useState(null);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraCountryCodes, setExtraCountryCodes] = useState([]);
  const [extraDups, setExtraDups] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDept = (dept) => {
    const types = DEPT_TYPES[dept] || [];
    setForm(f => ({ ...f, department: dept, contact_type: types[0] || '' }));
  };
  const availableTypes = DEPT_TYPES[form.department] || [];

  const checkPhoneNumber = (phone) => {
    if (!phone || !validatePhone(phone)) return;
    clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      setChecking(true);
      try {
        const dup = await checkDup(phone);
        setDupWarning(dup || null);
      } catch { setDupWarning(null); }
      setChecking(false);
    }, 400);
  };

  const handleSave = async () => {
    if (!form.department) { toast.error(isRTL ? 'يرجى اختيار القسم' : 'Please select a department'); return; }
    if (!form.contact_type) { toast.error(isRTL ? 'يرجى اختيار نوع جهة الاتصال' : 'Please select contact type'); return; }
    if (!form.full_name.trim()) { toast.error(isRTL ? 'الاسم مطلوب' : 'Name is required'); return; }
    if (!form.phone || !validatePhone(form.phone)) { toast.error(isRTL ? 'رقم الهاتف الأساسي غير صحيح' : 'Invalid primary phone number'); return; }
    const invalidExtra = extraPhones.find(p => p && !validatePhone(p));
    if (invalidExtra) { toast.error(isRTL ? `الرقم ${invalidExtra} غير صحيح` : `Invalid number: ${invalidExtra}`); return; }
    setSaving(true);
    try {
      const validExtras = extraPhones.filter(p => p && validatePhone(p));
      await onSave({
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        extra_phones: validExtras.length > 0 ? validExtras : null,
      });
      onClose();
    } catch (err) {
      toast.error((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={e => e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[560px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <div>
            <h2 className="m-0 text-content dark:text-content-dark text-[17px] font-bold">
              {isRTL ? ({
                lead: 'إضافة ليد', cold: 'إضافة كولد كول', client: 'إضافة عميل',
                supplier: 'إضافة مورد', developer: 'إضافة مطور عقاري',
                applicant: 'إضافة متقدم لوظيفة', partner: 'إضافة شريك'
              }[form.contact_type] || 'إضافة جهة اتصال') : ({
                lead: 'Add Lead', cold: 'Add Cold Call', client: 'Add Client',
                supplier: 'Add Supplier', developer: 'Add Developer',
                applicant: 'Add Applicant', partner: 'Add Partner'
              }[form.contact_type] || 'Add Contact')}
            </h2>
            <p className="mt-[3px] mb-0 text-xs text-content-muted dark:text-content-muted-dark">
              {step === 1 ? (isRTL ? 'البيانات الأساسية' : 'Basic Info') : (isRTL ? 'البيانات الإضافية' : 'Additional Info')}
              {' '}<span className="text-brand-400/50">({isRTL ? `${step} من 2` : `${step} of 2`})</span>
            </p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg"><X size={18} /></button>
        </div>
        <div className="h-[3px] bg-brand-500/15 rounded-b-sm">
          <div className="h-full bg-gradient-to-r from-brand-900 to-brand-500 rounded-b-sm transition-[width] duration-300 ease-in-out" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 1 ? (
            <div className="modal-grid grid grid-cols-2 gap-3.5">
              {/* القسم والنوع */}
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'القسم' : 'Department'} <span className="text-red-500">*</span></label>
                <Select value={form.department} onChange={e => setDept(e.target.value)}>
                  <option value="">{isRTL ? 'اختر القسم...' : 'Select department...'}</option>
                  <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                  <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                  <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                  <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                  <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'النوع' : 'Type'} <span className="text-red-500">*</span></label>
                <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)} disabled={!form.department}>
                  {!form.department && <option value="">{isRTL ? 'اختر القسم أولاً...' : 'Select department first...'}</option>}
                  {availableTypes.map(t => <option key={t} value={t}>{isRTL ? ({lead:'ليد',cold:'كولد كول',client:'عميل',supplier:'مورد',developer:'مطور عقاري',applicant:'متقدم لوظيفة',partner:'شريك'}[t]) : ({lead:'Lead',cold:'Cold Call',client:'Client',supplier:'Supplier',developer:'Developer',applicant:'Applicant',partner:'Partner'}[t])}</option>)}
                </Select>
              </div>

              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                <div className="flex gap-2">
                  <Select className="!w-[110px] shrink-0" value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                    <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                    <option value="Mr.">{isRTL ? 'السيد' : 'Mr.'}</option>
                    <option value="Mrs.">{isRTL ? 'السيدة' : 'Mrs.'}</option>
                    <option value="Dr.">{isRTL ? 'د.' : 'Dr.'}</option>
                    <option value="Eng.">{isRTL ? 'م.' : 'Eng.'}</option>
                    <option value="أستاذ">{isRTL ? 'أستاذ' : 'Prof.'}</option>
                  </Select>
                  <Input className="flex-1" placeholder={isRTL ? 'محمد أحمد...' : 'John Doe...'} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span> {(() => { const v = form.phone; return (<>{v && !validatePhone(v) && <span className="text-xs text-orange-500">⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}{v && validatePhone(v) && (() => { const info = getPhoneInfo(v); return info ? <span className="text-xs text-emerald-500">{info.flag} {info.country} — {info.formatted}</span> : null; })()}</>); })()}</label>
                <div className="flex gap-1.5">
                  <Select className="!w-[100px] shrink-0" value={form.countryCode} onChange={e => set('countryCode', e.target.value)}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                  </Select>
                  <Input className={`flex-1 ${dupWarning ? '!border-red-500' : ''}`}
                    placeholder="10xxxxxxxx" value={form.phone}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9+]/g, '');
                      // If pasted with + prefix, auto-detect country code
                      if (v.startsWith('+')) {
                        const detected = getCountryFromPhone(v);
                        set('countryCode', detected);
                        set('phone', v);
                      } else if (v.startsWith('0') && v.length >= 3) {
                        // Local number - store as-is, normalizePhone will handle it
                        set('phone', v);
                      } else {
                        set('phone', v);
                      }
                      setDupWarning(null);
                      const phoneToValidate = v.startsWith('+') || v.startsWith('0') ? v : form.countryCode + v;
                      if (validatePhone(phoneToValidate)) { checkPhoneNumber(phoneToValidate); }
                    }} />
                </div>
                {checking && <p className="text-xs text-content-muted dark:text-content-muted-dark mt-1 mb-0">{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div className="mt-2 p-3 bg-red-500/[0.08] border border-red-500/30 rounded-xl text-xs">
                    <div className="text-red-500 font-bold mb-2">⚠️ {isRTL ? 'هذا الرقم مسجل باسم' : 'This number belongs to'}: <strong>{dupWarning.full_name}</strong> <span className="text-xs text-content-muted dark:text-content-muted-dark font-mono">— ID: {dupWarning.id}</span></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { onOpenOpportunity(dupWarning); onClose(); }} className="flex-1">
                        ✨ {isRTL ? 'فتح فرصة جديدة لـ ' + dupWarning.full_name : 'New opportunity for ' + dupWarning.full_name}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={onClose}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-2">{isRTL ? 'أرقام إضافية' : 'Additional Phones'}</label>
                {extraPhones.map((ph, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex gap-1.5">
                      <Input className="flex-1" placeholder="012xxxxxxxx or +966..."
                        value={ph}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9+]/g, '');
                          const updated = [...extraPhones]; updated[i] = v; setExtraPhones(updated);
                          setExtraDups(d => { const nd = [...d]; nd[i] = null; return nd; });
                          if (validatePhone(v)) { checkDup(v).then(dup => { setExtraDups(d => { const nd = [...d]; nd[i] = dup || null; return nd; }); }).catch(() => {}); }
                        }} />
                      <button type="button" onClick={() => { setExtraPhones(extraPhones.filter((_, j) => j !== i)); setExtraDups(d => d.filter((_, j) => j !== i)); }}
                        className="px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 cursor-pointer text-lg leading-none">×</button>
                    </div>
                    {ph && (<div className="mt-1">
                      {!validatePhone(ph) && <span className="text-xs text-orange-500">⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}
                      {validatePhone(ph) && (() => { const info = getPhoneInfo(ph); return info ? <span className="text-xs text-emerald-500">{info.flag} {info.country} — {info.formatted}</span> : null; })()}
                    </div>)}
                    {extraDups[i] && (
                      <div className="mt-1.5 p-2 bg-red-500/[0.08] border border-red-500/30 rounded-lg text-xs">
                        <div className="text-red-500 font-bold mb-1">⚠️ {isRTL ? 'مسجل باسم' : 'Registered to'}: <strong>{extraDups[i].full_name}</strong> <span className="text-content-muted dark:text-content-muted-dark font-mono text-xs">ID: {extraDups[i].id}</span></div>
                        <Button size="sm" onClick={() => { onOpenOpportunity(extraDups[i]); onClose(); }} className="w-full">
                          ✨ {isRTL ? 'فتح فرصة جديدة' : 'New Opportunity'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => { setExtraPhones([...extraPhones, '']); setExtraDups([...extraDups, null]); }}>
                  + {isRTL ? 'إضافة رقم' : 'Add Phone'}
                </Button>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <Input type="email" placeholder="email@domain.com" value={form.email} onChange={e => set('email', e.target.value)} />
                {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
                  <p className="mt-1 mb-0 text-xs text-orange-500">⚠️ {isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format'}</p>
                )}
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'اسم الحملة' : 'Campaign'}</label>
                <Input placeholder={isRTL ? 'مثال: حملة الشيخ زايد Q1' : 'e.g. Sheikh Zayed Q1 Campaign'} value={form.campaign_name} onChange={e => set('campaign_name', e.target.value)} />
              </div>
              </>)}
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الشركة / جهة العمل' : 'Company'}</label>
                <Input placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
                <Input placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
              </div>

            </div>
          ) : (
            <div className="modal-grid grid grid-cols-2 gap-3.5">
              {!['lead', 'cold'].includes(form.contact_type) && (
                <>
                <div>
                  <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الجنس' : 'Gender'}</label>
                  <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                    <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                    <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الجنسية' : 'Nationality'}</label>
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
                <div className="col-span-full">
                  <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'تاريخ الميلاد' : 'Birth Date'}</label>
                  <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
                </div>
                </>
              )}
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ميزانية من' : 'Budget From (EGP)'}</label>
                <Input type="number" placeholder="1500000" value={form.budget_min} onChange={e => set('budget_min', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ميزانية إلى' : 'Budget To (EGP)'}</label>
                <Input type="number" placeholder="3000000" value={form.budget_max} onChange={e => set('budget_max', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الموقع المفضل' : 'Preferred Location'}</label>
                <Input placeholder={isRTL ? 'الشيخ زايد، التجمع...' : 'Sheikh Zayed, New Cairo...'} value={form.preferred_location} onChange={e => set('preferred_location', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نوع العقار' : 'Property Type'}</label>
                <Select value={form.interested_in_type} onChange={e => set('interested_in_type', e.target.value)}>
                  <option value="">{isRTL ? 'اختر نوع العقار...' : 'Select property type...'}</option>
                  <option value="residential">{isRTL ? 'سكني' : 'Residential'}</option>
                  <option value="commercial">{isRTL ? 'تجاري' : 'Commercial'}</option>
                  <option value="administrative">{isRTL ? 'إداري' : 'Administrative'}</option>
                </Select>
              </div>
              </>)}
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <Textarea rows={4} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge dark:border-edge-dark flex justify-between items-center">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <div className="flex gap-2.5">
            {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}>{isRTL ? 'السابق →' : '← Back'}</Button>}
            {step === 1
              ? (() => { const canNext = form.department && form.contact_type && form.full_name.trim() && validatePhone(form.phone) && !dupWarning; return <Button onClick={() => setStep(2)} disabled={!canNext}>{isRTL ? '← التالي' : 'Next →'}</Button>; })()
              : <Button onClick={handleSave} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
