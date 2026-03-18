import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { Save, Settings, Palette, Globe, User, Building2, Phone, Mail, MapPin, DollarSign, Clock, Image, Upload } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';

const CURRENCIES = [
  { value: 'EGP', label_ar: 'جنيه مصري (EGP)', label_en: 'Egyptian Pound (EGP)' },
  { value: 'SAR', label_ar: 'ريال سعودي (SAR)', label_en: 'Saudi Riyal (SAR)' },
  { value: 'AED', label_ar: 'درهم إماراتي (AED)', label_en: 'UAE Dirham (AED)' },
  { value: 'USD', label_ar: 'دولار أمريكي (USD)', label_en: 'US Dollar (USD)' },
  { value: 'EUR', label_ar: 'يورو (EUR)', label_en: 'Euro (EUR)' },
  { value: 'GBP', label_ar: 'جنيه إسترليني (GBP)', label_en: 'British Pound (GBP)' },
  { value: 'KWD', label_ar: 'دينار كويتي (KWD)', label_en: 'Kuwaiti Dinar (KWD)' },
  { value: 'QAR', label_ar: 'ريال قطري (QAR)', label_en: 'Qatari Riyal (QAR)' },
  { value: 'BHD', label_ar: 'دينار بحريني (BHD)', label_en: 'Bahraini Dinar (BHD)' },
  { value: 'OMR', label_ar: 'ريال عماني (OMR)', label_en: 'Omani Rial (OMR)' },
];

const TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Cairo (UTC+2)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Kuwait', label: 'Kuwait (UTC+3)' },
  { value: 'Asia/Qatar', label: 'Qatar (UTC+3)' },
  { value: 'Asia/Bahrain', label: 'Bahrain (UTC+3)' },
  { value: 'Asia/Muscat', label: 'Muscat (UTC+4)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
];


function CompanyInfoSection({ isRTL }) {
  const { companyInfo, updateSection } = useSystemConfig();
  const [form, setForm] = useState({ ...companyInfo });
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateSection('companyInfo', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(isRTL ? 'حجم الصورة يجب أن يكون أقل من 2MB' : 'Image size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => handleChange('logo_url', ev.target.result);
    reader.readAsDataURL(file);
  };

  const selectStyle = 'w-full px-3 py-2 text-sm rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark font-cairo focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500';

  return (
    <Card className="p-5 mb-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
          <Building2 size={16} className="text-brand-500" />{isRTL ? 'معلومات الشركة' : 'Company Info'}
        </h3>
        <Button variant={saved ? 'success' : 'primary'} size="sm" onClick={handleSave}>
          <Save size={13} /> {saved ? (isRTL ? 'تم الحفظ ✓' : 'Saved ✓') : (isRTL ? 'حفظ' : 'Save')}
        </Button>
      </div>

      {/* Logo */}
      <div className="mb-4 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-xl border-2 border-dashed border-edge dark:border-edge-dark flex items-center justify-center overflow-hidden cursor-pointer bg-surface-input dark:bg-surface-input-dark hover:border-brand-500 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Image size={24} className="text-content-muted dark:text-content-muted-dark" />
          )}
        </div>
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs font-semibold text-brand-500 hover:text-brand-600 cursor-pointer bg-transparent border-none font-cairo flex items-center gap-1"
          >
            <Upload size={12} /> {isRTL ? 'رفع شعار' : 'Upload Logo'}
          </button>
          <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'PNG, JPG — أقصى حجم 2MB' : 'PNG, JPG — Max 2MB'}
          </p>
          {form.logo_url && (
            <button
              onClick={() => handleChange('logo_url', '')}
              className="text-[10px] text-red-500 hover:text-red-600 cursor-pointer bg-transparent border-none font-cairo mt-0.5"
            >
              {isRTL ? 'إزالة' : 'Remove'}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
      </div>

      {/* Company Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (عربي)' : 'Company Name (Arabic)'}</label>
          <Input value={form.name_ar} onChange={e => handleChange('name_ar', e.target.value)} placeholder="اسم الشركة" dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (إنجليزي)' : 'Company Name (English)'}</label>
          <Input value={form.name_en} onChange={e => handleChange('name_en', e.target.value)} placeholder="Company Name" />
        </div>
      </div>

      {/* Phone & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <Phone size={11} /> {isRTL ? 'الهاتف' : 'Phone'}
          </label>
          <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+20 1XX XXX XXXX" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <Mail size={11} /> {isRTL ? 'البريد الإلكتروني' : 'Email'}
          </label>
          <Input value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="info@company.com" dir="ltr" />
        </div>
      </div>

      {/* Address */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <MapPin size={11} /> {isRTL ? 'العنوان (عربي)' : 'Address (Arabic)'}
          </label>
          <Input value={form.address_ar} onChange={e => handleChange('address_ar', e.target.value)} placeholder="العنوان بالعربي" dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <MapPin size={11} /> {isRTL ? 'العنوان (إنجليزي)' : 'Address (English)'}
          </label>
          <Input value={form.address_en} onChange={e => handleChange('address_en', e.target.value)} placeholder="Address in English" />
        </div>
      </div>

      {/* Currency & Timezone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <DollarSign size={11} /> {isRTL ? 'العملة' : 'Currency'}
          </label>
          <select
            value={form.currency}
            onChange={e => handleChange('currency', e.target.value)}
            className={selectStyle}
          >
            {CURRENCIES.map(c => (
              <option key={c.value} value={c.value}>{isRTL ? c.label_ar : c.label_en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block flex items-center gap-1">
            <Clock size={11} /> {isRTL ? 'المنطقة الزمنية' : 'Timezone'}
          </label>
          <select
            value={form.timezone}
            onChange={e => handleChange('timezone', e.target.value)}
            className={selectStyle}
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}


function ProfileSection({ profile, isRTL }) {
  return (
    <Card className="p-5 mb-5">
      <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
        <User size={16} className="text-brand-500" />{isRTL ? 'الملف الشخصي' : 'Profile'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الاسم بالعربي' : 'Arabic Name'}</label>
          <Input value={profile?.full_name_ar || ''} readOnly />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الاسم بالإنجليزي' : 'English Name'}</label>
          <Input value={profile?.full_name_en || ''} readOnly />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
          <Input value={profile?.email || ''} readOnly />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الدور' : 'Role'}</label>
          <Input value={profile?.role || ''} readOnly />
        </div>
      </div>
      <p className="mt-3 mb-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لتعديل البيانات تواصل مع المدير' : 'Contact admin to update profile'}</p>
    </Card>
  );
}

function AppearanceSection({ isRTL, isDark, toggleTheme, handleLangToggle, lang }) {
  return (
    <Card className="p-5 mb-5">
      <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
        <Palette size={16} className="text-brand-500" />{isRTL ? 'المظهر' : 'Appearance'}
      </h3>
      <div className="flex gap-3">
        <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer font-cairo text-center border-2 transition-all ${isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
          <div className="text-2xl mb-1.5">🌙</div>
          <div className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'داكن' : 'Dark'}</div>
          {isDark && <div className="text-[10px] text-brand-500 mt-1">{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
        <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer font-cairo text-center border-2 transition-all ${!isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
          <div className="text-2xl mb-1.5">☀️</div>
          <div className="text-xs font-semibold text-content dark:text-content-dark">{isRTL ? 'فاتح' : 'Light'}</div>
          {!isDark && <div className="text-[10px] text-brand-500 mt-1">{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
      </div>
      <div className="mt-4 px-4 py-3 rounded-xl bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-brand-500" />
          <span className="text-xs text-content dark:text-content-dark">{isRTL ? 'اللغة' : 'Language'}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={handleLangToggle}>
          {lang === 'ar' ? 'English' : 'عربي'}
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const handleLangToggle = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang).then(() => window.location.reload());
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-content dark:text-content-dark m-0 mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'هذه الصفحة للمديرين فقط' : 'This page is for admins only'}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <Settings size={20} className="text-brand-500" />
        </div>
        <div>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'الإعدادات' : 'Settings'}</h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'إدارة إعدادات النظام' : 'Manage system settings'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[900px]">
        <div>
          <CompanyInfoSection isRTL={isRTL} />
          <ProfileSection profile={profile} isRTL={isRTL} />
        </div>
        <div>
          <AppearanceSection isRTL={isRTL} isDark={isDark} toggleTheme={toggleTheme} handleLangToggle={handleLangToggle} lang={lang} />
        </div>
      </div>
    </div>
  );
}
