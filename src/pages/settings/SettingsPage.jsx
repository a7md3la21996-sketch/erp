import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Trash2, Save, Settings, Palette, Bell, Shield, Globe, User } from 'lucide-react';

const DEFAULT_ACTIVITY_TYPES = [
  { key: 'call',          label: 'Call',          labelAr: 'مكالمة',      icon: '📞' },
  { key: 'whatsapp',      label: 'WhatsApp',      labelAr: 'واتساب',      icon: '💬' },
  { key: 'email',         label: 'Email',         labelAr: 'إيميل',       icon: '📧' },
  { key: 'meeting',       label: 'Meeting',       labelAr: 'اجتماع',      icon: '🤝' },
  { key: 'site_visit',    label: 'Site Visit',    labelAr: 'زيارة موقع',  icon: '🏠' },
  { key: 'note',          label: 'Note',          labelAr: 'ملاحظة',      icon: '📝' },
  { key: 'status_change', label: 'Status Change', labelAr: 'تغيير حالة',  icon: '🔄' },
];

function ActivityTypesSettings({ c, inp }) {
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
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: c.text, fontSize: 15, fontWeight: 700 }}>
          {isRTL ? 'أنواع الأنشطة' : 'Activity Types'}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTypes(DEFAULT_ACTIVITY_TYPES)} style={{ padding: '6px 14px', background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {isRTL ? 'إعادة تعيين' : 'Reset'}
          </button>
          <button onClick={handleSave} style={{ padding: '6px 14px', background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: saved ? '1px solid #10B981' : 'none', borderRadius: 8, color: saved ? '#10B981' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            <Save size={13} /> {saved ? (isRTL ? 'تم الحفظ ✓' : 'Saved ✓') : (isRTL ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        {types.map((type, idx) => (
          <div key={type.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, minWidth: 28 }}>{type.icon}</span>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8 }}>
              <input style={inp} value={type.label} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, label: e.target.value } : t))} placeholder="English name" />
              <input style={inp} value={type.labelAr} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, labelAr: e.target.value } : t))} placeholder="الاسم بالعربي" dir="rtl" />
              <input style={{ ...inp, textAlign: 'center', fontSize: 18, padding: '4px' }} value={type.icon} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, icon: e.target.value } : t))} maxLength={2} />
            </div>
            <button onClick={() => handleDelete(type.key)} style={{ padding: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#EF4444', cursor: 'pointer', border: 'none' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ padding: 12, background: c.inputBg, border: `1px dashed ${c.border}`, borderRadius: 8 }}>
        <p style={{ margin: '0 0 10px', color: c.muted, fontSize: 12, fontWeight: 600 }}>
          {isRTL ? '+ إضافة نوع جديد' : '+ Add New Type'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px auto', gap: 8, alignItems: 'center' }}>
          <input style={inp} value={newType.label} onChange={e => setNewType(p => ({ ...p, label: e.target.value }))} placeholder="English name" />
          <input style={inp} value={newType.labelAr} onChange={e => setNewType(p => ({ ...p, labelAr: e.target.value }))} placeholder="الاسم بالعربي" dir="rtl" />
          <input style={{ ...inp, textAlign: 'center', fontSize: 18, padding: '4px' }} value={newType.icon} onChange={e => setNewType(p => ({ ...p, icon: e.target.value }))} maxLength={2} />
          <button onClick={handleAdd} disabled={!newType.label.trim()} style={{ padding: '8px 14px', background: newType.label.trim() ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : (c.inputBg), border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: newType.label.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ c, inp, profile, isRTL }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 16px', color: c.text, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <User size={16} color="#4A7AAB" />{isRTL ? 'الملف الشخصي' : 'Profile'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: c.muted, marginBottom: 4, display: 'block' }}>{isRTL ? 'الاسم بالعربي' : 'Arabic Name'}</label>
          <input style={inp} value={profile?.full_name_ar || ''} readOnly />
        </div>
        <div>
          <label style={{ fontSize: 12, color: c.muted, marginBottom: 4, display: 'block' }}>{isRTL ? 'الاسم بالإنجليزي' : 'English Name'}</label>
          <input style={inp} value={profile?.full_name_en || ''} readOnly />
        </div>
        <div>
          <label style={{ fontSize: 12, color: c.muted, marginBottom: 4, display: 'block' }}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
          <input style={inp} value={profile?.email || ''} readOnly />
        </div>
        <div>
          <label style={{ fontSize: 12, color: c.muted, marginBottom: 4, display: 'block' }}>{isRTL ? 'الدور' : 'Role'}</label>
          <input style={inp} value={profile?.role || ''} readOnly />
        </div>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: c.muted }}>{isRTL ? 'لتعديل البيانات تواصل مع المدير' : 'Contact admin to update profile'}</p>
    </div>
  );
}

function AppearanceSection({ c, isRTL, isDark, toggleTheme, handleLangToggle, lang }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 16px', color: c.text, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Palette size={16} color="#4A7AAB" />{isRTL ? 'المظهر' : 'Appearance'}
      </h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={toggleTheme} style={{
          flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
          border: `2px solid ${isDark ? '#4A7AAB' : c.border}`, background: isDark ? 'rgba(74,122,171,0.08)' : 'transparent',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🌙</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{isRTL ? 'داكن' : 'Dark'}</div>
          {isDark && <div style={{ fontSize: 10, color: '#4A7AAB', marginTop: 4 }}>{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
        <button onClick={toggleTheme} style={{
          flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
          border: `2px solid ${!isDark ? '#4A7AAB' : c.border}`, background: !isDark ? 'rgba(74,122,171,0.08)' : 'transparent',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>☀️</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{isRTL ? 'فاتح' : 'Light'}</div>
          {!isDark && <div style={{ fontSize: 10, color: '#4A7AAB', marginTop: 4 }}>{isRTL ? 'مفعّل' : 'Active'}</div>}
        </button>
      </div>
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: c.inputBg, border: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={16} color="#4A7AAB" />
          <span style={{ fontSize: 13, color: c.text }}>{isRTL ? 'اللغة' : 'Language'}</span>
        </div>
        <button onClick={handleLangToggle} style={{ padding: '5px 16px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.card, color: '#4A7AAB', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {lang === 'ar' ? 'English' : 'عربي'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const c = {
    bg: isDark ? '#0F1E2D' : '#F0F4F8',
    card: isDark ? '#1a2234' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text: isDark ? '#E2EAF4' : '#1f2937',
    muted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#f9fafb',
  };

  const inp = {
    background: c.inputBg, border: `1px solid ${c.border}`,
    borderRadius: 8, padding: '8px 12px', color: c.text,
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const handleLangToggle = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang).then(() => window.location.reload());
  };

  if (profile?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: c.text, margin: '0 0 8px' }}>{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p style={{ color: c.muted }}>{isRTL ? 'هذه الصفحة للمديرين فقط' : 'This page is for admins only'}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 28px', background: c.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="#4A7AAB" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: c.text }}>{isRTL ? 'الإعدادات' : 'Settings'}</h1>
          <p style={{ margin: 0, fontSize: 12, color: c.muted }}>{isRTL ? 'إدارة إعدادات النظام' : 'Manage system settings'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
        <div>
          <ProfileSection c={c} inp={inp} profile={profile} isRTL={isRTL} />
          <AppearanceSection c={c} isRTL={isRTL} isDark={isDark} toggleTheme={toggleTheme} handleLangToggle={handleLangToggle} lang={lang} />
        </div>
        <div>
          <ActivityTypesSettings c={c} inp={inp} />
        </div>
      </div>
    </div>
  );
}
