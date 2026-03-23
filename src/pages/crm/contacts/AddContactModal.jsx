import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { X } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  useEscClose, SOURCE_LABELS, SOURCE_EN,
  validatePhone, getPhoneInfo, normalizePhone,
  COUNTRY_CODES, getCountryFromPhone,
  SOURCE_PLATFORM, PLATFORM_LABELS, AD_SOURCES,
} from './constants';
import CustomFieldsRenderer from '../../../components/ui/CustomFieldsRenderer';
import { Plus } from 'lucide-react';

function CampaignCombo({ campaigns, source, value, isRTL, onChange, onCreateCampaign }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCamp, setNewCamp] = useState({ name_ar: '', name_en: '', target_location: '', target_property_type: '' });
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const sourceCampaigns = campaigns.filter(c => c.platform === source || !source);
  const displayList = (sourceCampaigns.length > 0 ? sourceCampaigns : campaigns)
    .filter(c => !search || (c.name_ar || '').includes(search) || (c.name_en || '').toLowerCase().includes(search.toLowerCase()));
  const noMatch = search && displayList.length === 0;

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-1.5">
        <Input
          value={value || search}
          onChange={e => { setSearch(e.target.value); onChange(''); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={isRTL ? 'ابحث أو اختر حملة...' : 'Search or select campaign...'}
          className="flex-1"
        />
        {value && <button onClick={() => { onChange(''); setSearch(''); }} className="px-2 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark cursor-pointer text-sm">×</button>}
      </div>

      {open && (
        <div className="absolute top-full mt-1 inset-x-0 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-50 max-h-[200px] overflow-y-auto">
          {displayList.map(c => (
            <button key={c.id} onClick={() => { onChange(isRTL ? c.name_ar : c.name_en); setSearch(''); setOpen(false); }}
              className="w-full text-start px-3 py-2 text-xs text-content dark:text-content-dark hover:bg-brand-500/[0.08] cursor-pointer border-none bg-transparent">
              <span className="font-semibold">{isRTL ? c.name_ar : c.name_en}</span>
              {c.target_location && <span className="text-content-muted dark:text-content-muted-dark ms-1.5">— {c.target_location}</span>}
            </button>
          ))}
          {noMatch && (
            <div className="px-3 py-2 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لا توجد نتائج' : 'No results'}
            </div>
          )}
          <button onClick={() => { setShowCreate(true); setOpen(false); }}
            className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-brand-500 hover:bg-brand-500/[0.08] cursor-pointer border-none bg-transparent border-t border-edge dark:border-edge-dark">
            <Plus size={13} /> {isRTL ? 'إنشاء حملة جديدة' : 'Create new campaign'}
          </button>
        </div>
      )}

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {/* Mini create campaign modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-[1100] flex items-center justify-center p-5" onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[420px] p-5" dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'إنشاء حملة جديدة' : 'Create New Campaign'}</h3>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'اسم الحملة (عربي)' : 'Campaign Name (AR)'}</label>
                  <Input value={newCamp.name_ar} onChange={e => setNewCamp(p => ({ ...p, name_ar: e.target.value }))} placeholder={isRTL ? 'حملة الشيخ زايد' : 'Arabic name'} />
                </div>
                <div>
                  <label className="block text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'اسم الحملة (إنجليزي)' : 'Campaign Name (EN)'}</label>
                  <Input value={newCamp.name_en} onChange={e => setNewCamp(p => ({ ...p, name_en: e.target.value }))} placeholder="Sheikh Zayed Campaign" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الموقع المستهدف' : 'Target Location'}</label>
                <Input value={newCamp.target_location} onChange={e => setNewCamp(p => ({ ...p, target_location: e.target.value }))} placeholder={isRTL ? 'الشيخ زايد، التجمع...' : 'Sheikh Zayed, New Cairo...'} />
              </div>
              <div>
                <label className="block text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'نوع العقار' : 'Property Type'}</label>
                <Select value={newCamp.target_property_type} onChange={e => setNewCamp(p => ({ ...p, target_property_type: e.target.value }))}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  <option value="residential">{isRTL ? 'سكني' : 'Residential'}</option>
                  <option value="commercial">{isRTL ? 'تجاري' : 'Commercial'}</option>
                  <option value="administrative">{isRTL ? 'إداري' : 'Administrative'}</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button size="sm" disabled={saving || (!newCamp.name_ar && !newCamp.name_en)} onClick={async () => {
                setSaving(true);
                const camp = {
                  name_ar: newCamp.name_ar || newCamp.name_en,
                  name_en: newCamp.name_en || newCamp.name_ar,
                  platform: source,
                  status: 'active',
                  budget: 0, spent: 0,
                  start_date: new Date().toISOString().slice(0, 10),
                  end_date: '',
                  type: 'paid_ads',
                  target_audience: 'new_leads',
                  target_location: newCamp.target_location,
                  target_property_type: newCamp.target_property_type,
                  notes: '',
                };
                if (onCreateCampaign) await onCreateCampaign(camp);
                const name = isRTL ? camp.name_ar : camp.name_en;
                onChange(name, camp);
                setSaving(false);
                setShowCreate(false);
                setNewCamp({ name_ar: '', name_en: '', target_location: '', target_property_type: '' });
              }}>
                {saving ? (isRTL ? 'جاري...' : 'Saving...') : (isRTL ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddContactModal({ onClose, onSave, checkDup, onOpenOpportunity, onAddInteraction, campaigns = [], onCreateCampaign }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { contactTypes } = useSystemConfig();
  useEscClose(onClose);
  const dupTimer = useRef(null);
  const [step, setStep] = useState(1);
  // Build DEPT_TYPES from system config — each type has a departments array
  const DEPT_TYPES = (() => {
    const map = { sales: [], hr: [], marketing: [], finance: [], operations: [] };
    (contactTypes || []).forEach(t => {
      (t.departments || []).forEach(d => { if (map[d] && !map[d].includes(t.key)) map[d].push(t.key); });
    });
    // Fallback if config has no departments set
    if (Object.values(map).every(v => v.length === 0)) {
      return { sales: ['lead','cold','developer','partner'], hr: ['applicant'], finance: ['supplier'], marketing: ['lead','cold'], operations: ['partner','supplier'] };
    }
    return map;
  })();
  const [form, setForm] = useState({
    prefix: '', full_name: '', phone: '', phone2: '', email: '',
    contact_type: '', source: 'facebook', platform: 'meta', campaign_name: '',
    budget_min: '', budget_max: '', preferred_location: '',
    interested_in_type: '', notes: '', department: '',
    gender: '', nationality: '', birth_date: '', company: '', job_title: '',
    countryCode: '+20',
    country: 'EG',
  });
  const [dupWarning, setDupWarning] = useState(null);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraCountryCodes, setExtraCountryCodes] = useState([]);
  const [extraDups, setExtraDups] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const loggedInteractionRef = useRef(null); // track which dup+campaign combo was logged
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: '' }));
    // Auto-log interaction when campaign_name is typed while duplicate exists
    if (k === 'campaign_name' && v && dupWarning && onAddInteraction) {
      const logKey = `${dupWarning.id}_${v}`;
      if (loggedInteractionRef.current !== logKey) {
        loggedInteractionRef.current = logKey;
        onAddInteraction(dupWarning, { campaign: v, source: form.source, platform: form.platform, date: new Date().toISOString() });
        setDupWarning(prev => prev ? { ...prev, _interactionLogged: true } : prev);
      }
    }
  };

  // Auto-detect country from local phone number prefix
  const detectCountryFromLocal = (phone) => {
    if (!phone || phone.startsWith('+')) return null;
    if (phone.startsWith('01') && phone.length >= 3 && ['0','1','2','5'].includes(phone[2])) return { code: '+20', country: 'EG', flag: '\u{1F1EA}\u{1F1EC}' };
    if (phone.startsWith('05')) return { code: '+966', country: 'SA', flag: '\u{1F1F8}\u{1F1E6}' };
    if (phone.startsWith('07')) return { code: '+962', country: 'JO', flag: '\u{1F1EF}\u{1F1F4}' };
    if (phone.startsWith('09')) return { code: '+964', country: 'IQ', flag: '\u{1F1EE}\u{1F1F6}' };
    return null;
  };
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
        if (dup && form.campaign_name && onAddInteraction) {
          const logKey = `${dup.id}_${form.campaign_name}`;
          if (loggedInteractionRef.current !== logKey) {
            loggedInteractionRef.current = logKey;
            onAddInteraction(dup, { campaign: form.campaign_name, source: form.source, platform: form.platform, date: new Date().toISOString() });
          }
          setDupWarning({ ...dup, _interactionLogged: true });
        } else {
          setDupWarning(dup || null);
        }
      } catch { setDupWarning(null); }
      setChecking(false);
    }, 400);
  };

  const getFullPhone = (phone, code) => {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('0')) return normalizePhone(phone);
    return code + phone;
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.department) errs.department = isRTL ? 'يرجى اختيار القسم' : 'Please select a department';
    if (!form.contact_type) errs.contact_type = isRTL ? 'يرجى اختيار نوع جهة الاتصال' : 'Please select contact type';
    const fullPhone = getFullPhone(form.phone, form.countryCode);
    if (!fullPhone || !validatePhone(fullPhone)) errs.phone = isRTL ? 'رقم الهاتف الأساسي غير صحيح' : 'Invalid primary phone number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format';
    if (Object.keys(errs).length) { setErrors(errs); if (errs.department || errs.contact_type || errs.phone) setStep(1); return; }
    setErrors({});
    const invalidExtra = extraPhones.find(p => p && !validatePhone(getFullPhone(p, form.countryCode)));
    if (invalidExtra) { toast.error(isRTL ? `الرقم ${invalidExtra} غير صحيح` : `Invalid number: ${invalidExtra}`); return; }
    setSaving(true);
    try {
      const validExtras = extraPhones.filter(p => p && validatePhone(getFullPhone(p, form.countryCode))).map(p => getFullPhone(p, form.countryCode));
      const { countryCode, ...formData } = form;
      await onSave({
        ...formData,
        phone: fullPhone,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        extra_phones: validExtras.length > 0 ? validExtras : null,
        _customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
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
              {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
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
            <div className="modal-grid grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* القسم والنوع */}
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'القسم' : 'Department'} <span className="text-red-500">*</span></label>
                <Select value={form.department} onChange={e => { setDept(e.target.value); setErrors(p => ({ ...p, department: '' })); }} style={errors.department ? { border: '1.5px solid #ef4444' } : {}}>
                  <option value="">{isRTL ? 'اختر القسم...' : 'Select department...'}</option>
                  <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                  <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                  <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                  <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                  <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
                </Select>
                {errors.department && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.department}</span>}
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'النوع' : 'Type'} <span className="text-red-500">*</span></label>
                <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)} disabled={!form.department} style={errors.contact_type ? { border: '1.5px solid #ef4444' } : {}}>
                  {!form.department && <option value="">{isRTL ? 'اختر القسم أولاً...' : 'Select department first...'}</option>}
                  {availableTypes.map(t => { const ct = (contactTypes || []).find(c => c.key === t); return <option key={t} value={t}>{ct ? (isRTL ? ct.label_ar : ct.label_en) : t}</option>; })}
                </Select>
                {errors.contact_type && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.contact_type}</span>}
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
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span> {(() => { const fp = getFullPhone(form.phone, form.countryCode); return (<>{fp && !validatePhone(fp) && <span className="text-xs text-orange-500">⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}{fp && validatePhone(fp) && (() => { const info = getPhoneInfo(fp); return info ? <span className="text-xs text-emerald-500">{info.flag} {info.country} — {info.formatted}</span> : null; })()}</>); })()}</label>
                <div className="flex gap-1.5 items-center">
                  <Select className="!w-[100px] shrink-0" value={form.countryCode} onChange={e => {
                    set('countryCode', e.target.value);
                    const match = COUNTRY_CODES.find(c => c.code === e.target.value);
                    if (match) set('country', match.country);
                  }}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                  </Select>
                  <Input className={`flex-1 ${dupWarning ? '!border-red-500' : ''}`}
                    placeholder="10xxxxxxxx" value={form.phone}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9+]/g, '');
                      set('phone', v);
                      // Auto-detect country from number
                      if (v.startsWith('+')) {
                        const detected = getCountryFromPhone(v);
                        set('countryCode', detected);
                        const match = COUNTRY_CODES.find(c => c.code === detected);
                        if (match) set('country', match.country);
                      } else {
                        const detected = detectCountryFromLocal(v);
                        if (detected) {
                          set('countryCode', detected.code);
                          set('country', detected.country);
                        }
                      }
                      setDupWarning(null);
                      const full = getFullPhone(v, form.countryCode);
                      if (validatePhone(full)) { checkPhoneNumber(full); }
                    }} />
                  {/* Country auto-detect indicator */}
                  {form.phone && !form.phone.startsWith('+') && (() => {
                    const det = detectCountryFromLocal(form.phone);
                    if (!det) return null;
                    const cc = COUNTRY_CODES.find(c => c.country === det.country);
                    return <span className="shrink-0 text-xs font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/10 px-2 py-1 rounded-lg whitespace-nowrap">{det.flag} {isRTL ? (cc?.labelAr || det.country) : (cc?.label || det.country)}</span>;
                  })()}
                </div>
                {errors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.phone}</span>}
                {checking && <p className="text-xs text-content-muted dark:text-content-muted-dark mt-1 mb-0">{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div className="mt-2 p-3 bg-red-500/[0.08] border border-red-500/30 rounded-xl text-xs">
                    <div className="text-red-500 font-bold mb-2">⚠️ {isRTL ? 'هذا الرقم مسجل باسم' : 'This number belongs to'}: <strong>{dupWarning.full_name}</strong> <span className="text-xs text-content-muted dark:text-content-muted-dark font-mono">— ID: {dupWarning.id}</span></div>
                    {dupWarning._interactionLogged && (
                      <div className="mb-2 p-2 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 font-semibold">
                        {isRTL ? `تم تسجيل تفاعل "${form.campaign_name}" تلقائيًا` : `"${form.campaign_name}" interaction logged automatically`}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => { onOpenOpportunity(dupWarning); onClose(); }} className="flex-1">
                        {isRTL ? 'فتح فرصة جديدة' : 'New opportunity'}
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
                <Input type="email" placeholder="email@domain.com" value={form.email} onChange={e => set('email', e.target.value)} style={errors.email ? { border: '1.5px solid #ef4444' } : {}} />
                {(errors.email || (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))) && (
                  <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.email || (isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format')}</span>
                )}
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => { const src = e.target.value; set('source', src); set('platform', SOURCE_PLATFORM[src] || 'other'); if (!AD_SOURCES.includes(src)) set('campaign_name', ''); }}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المنصة' : 'Platform'}</label>
                <Input readOnly value={(() => { const p = PLATFORM_LABELS[form.platform]; return p ? (isRTL ? p.ar : p.en) : ''; })()} className="!bg-surface-bg dark:!bg-surface-bg-dark !cursor-default" />
              </div>
              {AD_SOURCES.includes(form.source) && (
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الحملة الإعلانية' : 'Ad Campaign'}</label>
                <CampaignCombo
                  campaigns={campaigns}
                  source={form.source}
                  value={form.campaign_name}
                  isRTL={isRTL}
                  onChange={(campName, campData) => {
                    set('campaign_name', campName);
                    const camp = campData || campaigns.find(c => (c.name_ar === campName || c.name_en === campName));
                    if (camp) {
                      if (camp.target_location) set('preferred_location', camp.target_location);
                      if (camp.target_property_type) set('interested_in_type', camp.target_property_type);
                    }
                  }}
                  onCreateCampaign={onCreateCampaign}
                />
              </div>
              )}
              </>)}
              {form.department !== 'sales' && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الشركة / جهة العمل' : 'Company'}</label>
                <Input placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
                <Input placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
              </div>
              </>)}

            </div>
          ) : (
            <div className="modal-grid grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {form.department !== 'sales' && (
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
              <div className="col-span-full">
                <CustomFieldsRenderer entity="contact" mode="edit" values={customFieldValues} onChange={setCustomFieldValues} defaultCollapsed={false} />
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
              ? (() => { const canNext = form.department && form.contact_type && validatePhone(getFullPhone(form.phone, form.countryCode)) && !dupWarning; return <Button onClick={() => setStep(2)} disabled={!canNext}>{isRTL ? '← التالي' : 'Next →'}</Button>; })()
              : <Button onClick={handleSave} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
