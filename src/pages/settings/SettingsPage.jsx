import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';

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

  const handleDelete = (key) => {
    setTypes(prev => prev.filter(t => t.key !== key));
  };

  const handleAdd = () => {
    if (!newType.label.trim()) return;
    const key = newType.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    setTypes(prev => [...prev, { ...newType, key }]);
    setNewType({ label: '', labelAr: '', icon: '📋' });
  };

  const handleReset = () => {
    setTypes(DEFAULT_ACTIVITY_TYPES);
  };

  const inp = {
    background: '#0F1E2D', border: '1px solid rgba(74,122,171,0.25)',
    borderRadius: 8, padding: '8px 12px', color: '#E2EAF4',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#152232', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#E2EAF4', fontSize: 15, fontWeight: 700 }}>
          {isRTL ? 'أنواع الأنشطة' : 'Activity Types'}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={{ padding: '6px 14px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: '#8BA8C8', fontSize: 12, cursor: 'pointer' }}>
            {isRTL ? 'إعادة تعيين' : 'Reset'}
          </button>
          <button onClick={handleSave} style={{ padding: '6px 14px', background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: saved ? '1px solid #10B981' : 'none', borderRadius: 8, color: saved ? '#10B981' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={13} /> {saved ? (isRTL ? 'تم الحفظ ✓' : 'Saved ✓') : (isRTL ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>

      {/* Existing types */}
      <div style={{ marginBottom: 16 }}>
        {types.map((type, idx) => (
          <div key={type.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(74,122,171,0.05)', border: '1px solid rgba(74,122,171,0.1)', borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, minWidth: 28 }}>{type.icon}</span>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8 }}>
              <input style={inp} value={type.label} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, label: e.target.value } : t))} placeholder="English name" />
              <input style={inp} value={type.labelAr} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, labelAr: e.target.value } : t))} placeholder="الاسم بالعربي" dir="rtl" />
              <input style={{ ...inp, textAlign: 'center', fontSize: 18, padding: '4px' }} value={type.icon} onChange={e => setTypes(prev => prev.map((t, i) => i === idx ? { ...t, icon: e.target.value } : t))} placeholder="🎯" maxLength={2} />
            </div>
            <button onClick={() => handleDelete(type.key)} style={{ padding: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#EF4444', cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new type */}
      <div style={{ padding: '12px', background: 'rgba(74,122,171,0.05)', border: '1px dashed rgba(74,122,171,0.3)', borderRadius: 8 }}>
        <p style={{ margin: '0 0 10px', color: '#6B8DB5', fontSize: 12, fontWeight: 600 }}>
          {isRTL ? '+ إضافة نوع جديد' : '+ Add New Type'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px auto', gap: 8, alignItems: 'center' }}>
          <input style={inp} value={newType.label} onChange={e => setNewType(p => ({ ...p, label: e.target.value }))} placeholder="English name" />
          <input style={inp} value={newType.labelAr} onChange={e => setNewType(p => ({ ...p, labelAr: e.target.value }))} placeholder="الاسم بالعربي" dir="rtl" />
          <input style={{ ...inp, textAlign: 'center', fontSize: 18, padding: '4px' }} value={newType.icon} onChange={e => setNewType(p => ({ ...p, icon: e.target.value }))} placeholder="🎯" maxLength={2} />
          <button onClick={handleAdd} disabled={!newType.label.trim()} style={{ padding: '8px 14px', background: newType.label.trim() ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: newType.label.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';

  if (profile?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: '#374151', margin: '0 0 8px' }}>{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p style={{ color: '#9ca3af' }}>{isRTL ? 'هذه الصفحة للمديرين فقط' : 'This page is for admins only'}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1B3347' }}>
          {isRTL ? 'الإعدادات' : 'Settings'}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {isRTL ? 'إدارة إعدادات النظام' : 'Manage system settings'}
        </p>
      </div>

      <ActivityTypesSettings />
    </div>
  );
}
