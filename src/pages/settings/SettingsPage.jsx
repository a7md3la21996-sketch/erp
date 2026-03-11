import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Trash2, Save, Settings, Palette, Globe, User } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';

const DEFAULT_ACTIVITY_TYPES = [
  { key: 'call',          label: 'Call',          labelAr: 'مكالمة',      icon: '📞' },
  { key: 'whatsapp',      label: 'WhatsApp',      labelAr: 'واتساب',      icon: '💬' },
  { key: 'email',         label: 'Email',         labelAr: 'إيميل',       icon: '📧' },
  { key: 'meeting',       label: 'Meeting',       labelAr: 'اجتماع',      icon: '🤝' },
  { key: 'site_visit',    label: 'Site Visit',    labelAr: 'زيارة موقع',  icon: '🏠' },
  { key: 'note',          label: 'Note',          labelAr: 'ملاحظة',      icon: '📝' },
  { key: 'status_change', label: 'Status Change', labelAr: 'تغيير حالة',  icon: '🔄' },
];

function ActivityTypesSettings() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [types, setTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('platform_activity_types');
      return saved ? JSON.parse(saved) : DEFAULT_ACTIVITY_TYPES;
    } catch { return DEFAULT_ACTIVITY_TYPES; }
  });
  const [saved, setSaved] = useState(false);
  const [newType, setNewType] = useState({ label: '', labelAr: '', icon: '📋' });

  const handleSave = () => {
    localStorage.setItem('platform_activity_types', JSON.stringify(types));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (key) => setTypes(prev => prev.filter(t => t.key !== key));

  const handleAdd = () => {
    if (!newType.label.trim()) return;
    const key = newType.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    setTypes(prev => [...prev, { ...newType, key }]);
    setNewType({ label: '', labelAr: '', icon: '📋' });
  };

  return (
    <Card className="p-5 mb-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-[15px] font-bold text-content dark:text-content-dark">
          {isRTL ? 'أنواع الأنشطة' : 'Activity Types'}
        </h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setTypes(DEFAULT_ACTIVITY_TYPES)}>
            {isRTL ? 'إعادة تعيين' : 'Reset'}
          </Button>
          <Button variant={saved ? 'success' : 'primary'} size="sm" onClick={handleSave}>
            <Save size={13} /> {saved ? (isRTL ? 'تم الحفظ ✓' : 'Saved ✓') : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        {types.map((type, idx) => (
          <div key={type.key} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg mb-2">
            <span className="text-lg min-w-[28px]">{type.icon}</span>
            <div className="flex-1 grid grid-cols-[1fr_1fr_60px] gap-2">
              <Input value={type.label} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, label: e.target.value } : t))} placeholder="English name" size="sm" />
              <Input value={type.labelAr} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, labelAr: e.target.value } : t))} placeholder="الاسم بالعربي" dir="rtl" size="sm" />
              <Input value={type.icon} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, icon: e.target.value } : t))} maxLength={2} size="sm" className="text-center !text-lg !px-1" />
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(type.key)} className="!p-1.5">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة نوع جديد' : '+ Add New Type'}
        </p>
        <div className="grid grid-cols-[1fr_1fr_60px_auto] gap-2 items-center">
          <Input value={newType.label} onChange={e => setNewType(p => ({ ...p, label: e.target.value }))} placeholder="English name" size="sm" />
          <Input value={newType.labelAr} onChange={e => setNewType(p => ({ ...p, labelAr: e.target.value }))} placeholder="الاسم بالعربي" dir="rtl" size="sm" />
          <Input value={newType.icon} onChange={e => setNewType(p => ({ ...p, icon: e.target.value }))} maxLength={2} size="sm" className="text-center !text-lg !px-1" />
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newType.label.trim()} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProfileSection({ profile, isRTL }) {
  return (
    <Card className="p-5 mb-5">
      <h3 className="m-0 mb-4 text-[15px] font-bold text-content dark:text-content-dark flex items-center gap-2">
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
      <p className="mt-3 mb-0 text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'لتعديل البيانات تواصل مع المدير' : 'Contact admin to update profile'}</p>
    </Card>
  );
}

function AppearanceSection({ isRTL, isDark, toggleTheme, handleLangToggle, lang }) {
  return (
    <Card className="p-5 mb-5">
      <h3 className="m-0 mb-4 text-[15px] font-bold text-content dark:text-content-dark flex items-center gap-2">
        <Palette size={16} className="text-brand-500" />{isRTL ? 'المظهر' : 'Appearance'}
      </h3>
      <div className="flex gap-3">
        <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer font-cairo text-center border-2 transition-all ${isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
          <div className="text-2xl mb-1.5">🌙</div>
          <div className="text-[13px] font-semibold text-content dark:text-content-dark">{isRTL ? 'داكن' : 'Dark'}</div>
          {isDark && <div className="text-[10px] text-brand-500 mt-1">{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
        <button onClick={toggleTheme} className={`flex-1 p-4 rounded-xl cursor-pointer font-cairo text-center border-2 transition-all ${!isDark ? 'border-brand-500 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}>
          <div className="text-2xl mb-1.5">☀️</div>
          <div className="text-[13px] font-semibold text-content dark:text-content-dark">{isRTL ? 'فاتح' : 'Light'}</div>
          {!isDark && <div className="text-[10px] text-brand-500 mt-1">{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
      </div>
      <div className="mt-4 px-4 py-3 rounded-[10px] bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-brand-500" />
          <span className="text-[13px] text-content dark:text-content-dark">{isRTL ? 'اللغة' : 'Language'}</span>
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
      <div className="flex items-center gap-3 mb-6">
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
          <ProfileSection profile={profile} isRTL={isRTL} />
          <AppearanceSection isRTL={isRTL} isDark={isDark} toggleTheme={toggleTheme} handleLangToggle={handleLangToggle} lang={lang} />
        </div>
        <div>
          <ActivityTypesSettings />
        </div>
      </div>
    </div>
  );
}
