import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Package, Plus, X, Search, CheckCircle, AlertTriangle, User, Edit2, Trash2 } from 'lucide-react';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

const ASSET_TYPES = [
  { key: 'laptop',  ar: 'لابتوب',    en: 'Laptop',    icon: '💻', color: '#3B82F6' },
  { key: 'mobile',  ar: 'موبايل',    en: 'Mobile',    icon: '📱', color: '#10B981' },
  { key: 'car',     ar: 'سيارة',     en: 'Car',       icon: '🚗', color: '#F59E0B' },
  { key: 'card',    ar: 'بطاقة',     en: 'Card',      icon: '💳', color: '#6366F1' },
  { key: 'other',   ar: 'أخرى',      en: 'Other',     icon: '📦', color: '#EC4899' },
];

const STATUS_CONFIG = {
  assigned:   { ar: 'مخصص',    en: 'Assigned',   color: '#10B981', bg: '#10B98115' },
  available:  { ar: 'متاح',    en: 'Available',  color: '#3B82F6', bg: '#3B82F615' },
  maintenance:{ ar: 'صيانة',   en: 'Maintenance',color: '#F59E0B', bg: '#F59E0B15' },
  retired:    { ar: 'متقاعد',  en: 'Retired',    color: '#6B7280', bg: '#6B728015' },
};

const INITIAL_ASSETS = [
  { id: 'a1', type: 'laptop',  name: 'MacBook Pro 14"',        serial: 'MBP-2024-001', employee_id: 'e1', assigned_date: '2024-01-15', status: 'assigned',  value: 45000, notes: '' },
  { id: 'a2', type: 'mobile',  name: 'iPhone 15 Pro',          serial: 'IPH-2024-001', employee_id: 'e1', assigned_date: '2024-01-15', status: 'assigned',  value: 28000, notes: '' },
  { id: 'a3', type: 'laptop',  name: 'Dell XPS 15',            serial: 'DLL-2023-005', employee_id: 'e2', assigned_date: '2023-06-01', status: 'assigned',  value: 35000, notes: '' },
  { id: 'a4', type: 'car',     name: 'Toyota Corolla 2023',    serial: 'CAR-2023-001', employee_id: 'e3', assigned_date: '2023-03-10', status: 'assigned',  value: 280000, notes: 'لوحة: أ ب ج 1234' },
  { id: 'a5', type: 'laptop',  name: 'HP EliteBook 840',       serial: 'HP-2022-012',  employee_id: null, assigned_date: null,         status: 'available', value: 22000, notes: '' },
  { id: 'a6', type: 'mobile',  name: 'Samsung Galaxy S24',     serial: 'SAM-2024-003', employee_id: 'e4', assigned_date: '2024-03-01', status: 'assigned',  value: 18000, notes: '' },
  { id: 'a7', type: 'laptop',  name: 'Lenovo ThinkPad X1',     serial: 'LNV-2023-008', employee_id: null, assigned_date: null,         status: 'maintenance',value: 30000, notes: 'شاشة مكسورة' },
  { id: 'a8', type: 'card',    name: 'بطاقة ائتمان شركة',      serial: 'CRD-2024-001', employee_id: 'e5', assigned_date: '2024-02-01', status: 'assigned',  value: 0,     notes: 'حد الانفاق 5000' },
];

const EMPTY_FORM = { type: 'laptop', name: '', serial: '', employee_id: '', assigned_date: '', status: 'available', value: 0, notes: '' };

export default function AssetsPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [assets, setAssets] = useState(INITIAL_ASSETS);
  const [employees] = useState(MOCK_EMPLOYEES);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  const filtered = useMemo(() => assets.filter(a => {
    const type = ASSET_TYPES.find(t => t.key === a.type);
    const name = a.name.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || a.serial.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  }), [assets, search, filterType, filterStatus]);

  const stats = {
    total: assets.length,
    assigned: assets.filter(a => a.status === 'assigned').length,
    available: assets.filter(a => a.status === 'available').length,
    maintenance: assets.filter(a => a.status === 'maintenance').length,
    totalValue: assets.reduce((s, a) => s + a.value, 0),
  };

  const openAdd = () => { setForm(EMPTY_FORM); setEditAsset(null); setShowAdd(true); };
  const openEdit = (asset) => { setForm({ ...asset, employee_id: asset.employee_id || '' }); setEditAsset(asset); setShowAdd(true); };

  const handleSave = () => {
    const data = { ...form, value: +form.value, employee_id: form.employee_id || null };
    if (editAsset) {
      setAssets(prev => prev.map(a => a.id === editAsset.id ? { ...data, id: editAsset.id } : a));
    } else {
      setAssets(prev => [...prev, { ...data, id: 'a' + Date.now() }]);
    }
    setShowAdd(false);
  };

  const handleDelete = (id) => setAssets(prev => prev.filter(a => a.id !== id));

  const inputStyle = () => ({ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' });

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#F59E0B,#F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'إدارة الأصول' : 'Assets Management'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'تتبع أصول الشركة المخصصة للموظفين' : 'Track company assets assigned to employees'}</p>
          </div>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={16} /> {lang === 'ar' ? 'أصل جديد' : 'New Asset'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: lang === 'ar' ? 'إجمالي' : 'Total', value: stats.total, color: '#6366F1', icon: '📦' },
          { label: lang === 'ar' ? 'مخصص' : 'Assigned', value: stats.assigned, color: '#10B981', icon: '✅' },
          { label: lang === 'ar' ? 'متاح' : 'Available', value: stats.available, color: '#3B82F6', icon: '💚' },
          { label: lang === 'ar' ? 'صيانة' : 'Maintenance', value: stats.maintenance, color: '#F59E0B', icon: '🔧' },
          { label: lang === 'ar' ? 'القيمة الإجمالية' : 'Total Value', value: (stats.totalValue / 1000).toFixed(0) + 'K', color: '#EC4899', icon: '💰' },
        ].map((s, i) => (
          <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '14px 16px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: c.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'ابحث...' : 'Search...'} style={{ width: '100%', padding: isRTL ? '9px 38px 9px 12px' : '9px 12px 9px 38px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, cursor: 'pointer' }}>
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          {ASSET_TYPES.map(t => <option key={t.key} value={t.key}>{lang === 'ar' ? t.ar : t.en}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, cursor: 'pointer' }}>
          <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC' }}>
              {[lang === 'ar' ? 'الأصل' : 'Asset', lang === 'ar' ? 'النوع' : 'Type', lang === 'ar' ? 'السيريال' : 'Serial', lang === 'ar' ? 'الموظف' : 'Employee', lang === 'ar' ? 'تاريخ التخصيص' : 'Assigned', lang === 'ar' ? 'القيمة' : 'Value', lang === 'ar' ? 'الحالة' : 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '11px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((asset, idx) => {
              const type = ASSET_TYPES.find(t => t.key === asset.type);
              const status = STATUS_CONFIG[asset.status];
              const emp = employees.find(e => e.id === asset.employee_id);
              return (
                <tr key={asset.id} style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.04)' : '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{asset.name}</div>
                    {asset.notes && <div style={{ fontSize: 11, color: c.textMuted }}>{asset.notes}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: type?.color + '15', color: type?.color }}>
                      {type?.icon} {lang === 'ar' ? type?.ar : type?.en}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: c.textMuted, fontFamily: 'monospace' }}>{asset.serial}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {emp ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${emp.id.charCodeAt(1) * 40},60%,50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                        </div>
                        <span style={{ fontSize: 13, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: c.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: c.textMuted }}>{asset.assigned_date || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: asset.value > 0 ? c.accent : c.textMuted }}>
                    {asset.value > 0 ? asset.value.toLocaleString() + (lang === 'ar' ? ' ج.م' : ' EGP') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.bg, color: status.color }}>
                      {lang === 'ar' ? status.ar : status.en}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <button onClick={() => openEdit(asset)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; }}
                      ><Edit2 size={12} /></button>
                      <button onClick={() => handleDelete(asset.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #EF444430', cursor: 'pointer', background: 'transparent', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: c.textMuted }}>
            <Package size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا توجد أصول' : 'No assets found'}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{editAsset ? (lang === 'ar' ? 'تعديل الأصل' : 'Edit Asset') : (lang === 'ar' ? 'أصل جديد' : 'New Asset')}</div>
              <button onClick={() => setShowAdd(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: lang === 'ar' ? 'النوع' : 'Type', field: (
                  <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle()}>
                    {ASSET_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {lang === 'ar' ? t.ar : t.en}</option>)}
                  </select>
                )},
                { label: lang === 'ar' ? 'الاسم *' : 'Name *', field: <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle()} placeholder={lang === 'ar' ? 'MacBook Pro 14"' : 'MacBook Pro 14"'} /> },
                { label: lang === 'ar' ? 'السيريال' : 'Serial Number', field: <input value={form.serial} onChange={e => set('serial', e.target.value)} style={inputStyle()} placeholder="MBP-2024-001" /> },
                { label: lang === 'ar' ? 'الموظف' : 'Employee', field: (
                  <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} style={inputStyle()}>
                    <option value="">{lang === 'ar' ? 'غير مخصص' : 'Unassigned'}</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
                  </select>
                )},
                { label: lang === 'ar' ? 'تاريخ التخصيص' : 'Assigned Date', field: <input type="date" value={form.assigned_date} onChange={e => set('assigned_date', e.target.value)} style={inputStyle()} /> },
                { label: lang === 'ar' ? 'القيمة (ج.م)' : 'Value (EGP)', field: <input type="number" value={form.value} onChange={e => set('value', e.target.value)} style={inputStyle()} min="0" /> },
                { label: lang === 'ar' ? 'الحالة' : 'Status', field: (
                  <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle()}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
                  </select>
                )},
                { label: lang === 'ar' ? 'ملاحظات' : 'Notes', field: <input value={form.notes} onChange={e => set('notes', e.target.value)} style={inputStyle()} /> },
              ].map((row, i) => (
                <div key={i}>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{row.label}</label>
                  {row.field}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={handleSave} disabled={!form.name.trim()} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: form.name.trim() ? 'pointer' : 'not-allowed', background: form.name.trim() ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : c.border, color: '#fff', fontSize: 13, fontWeight: 600, opacity: form.name.trim() ? 1 : 0.5 }}>
                {lang === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
