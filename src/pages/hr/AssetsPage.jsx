import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, Car, Key, Package, Plus, Search, AlertCircle, CheckCircle, X, Edit2, Trash2 } from 'lucide-react';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

const ASSET_TYPES = [
  { key: 'laptop',  ar: 'لابتوب',      en: 'Laptop',      icon: Monitor,    color: '#3B82F6' },
  { key: 'phone',   ar: 'موبايل',      en: 'Phone',       icon: Smartphone, color: '#10B981' },
  { key: 'car',     ar: 'سيارة',       en: 'Car',         icon: Car,        color: '#F59E0B' },
  { key: 'key',     ar: 'مفتاح/كارت', en: 'Key/Card',    icon: Key,        color: '#8B5CF6' },
  { key: 'other',   ar: 'أخرى',        en: 'Other',       icon: Package,    color: '#6B7280' },
];

const ASSET_STATUS = {
  assigned:    { ar: 'معين',       en: 'Assigned',    color: '#10B981', bg: '#10B98115' },
  available:   { ar: 'متاح',       en: 'Available',   color: '#3B82F6', bg: '#3B82F615' },
  maintenance: { ar: 'صيانة',      en: 'Maintenance', color: '#F59E0B', bg: '#F59E0B15' },
  retired:     { ar: 'متقاعد',     en: 'Retired',     color: '#6B7280', bg: '#6B728015' },
};

const MOCK_ASSETS = [
  { id: 'a1', type: 'laptop',  brand: 'Dell XPS 15',        serial: 'DL-2024-001', status: 'assigned', employee_id: 'e1',  assigned_date: '2024-01-15', condition: 'جيد' },
  { id: 'a2', type: 'phone',   brand: 'iPhone 14',          serial: 'IP-2024-002', status: 'assigned', employee_id: 'e2',  assigned_date: '2024-02-01', condition: 'ممتاز' },
  { id: 'a3', type: 'laptop',  brand: 'MacBook Pro',        serial: 'MB-2024-003', status: 'assigned', employee_id: 'e3',  assigned_date: '2024-01-20', condition: 'ممتاز' },
  { id: 'a4', type: 'car',     brand: 'Toyota Corolla',     serial: 'TC-2023-001', status: 'assigned', employee_id: 'e4',  assigned_date: '2023-06-01', condition: 'جيد' },
  { id: 'a5', type: 'laptop',  brand: 'Lenovo ThinkPad',    serial: 'LT-2024-004', status: 'available', employee_id: null, assigned_date: null,         condition: 'جيد' },
  { id: 'a6', type: 'phone',   brand: 'Samsung Galaxy S23', serial: 'SG-2024-005', status: 'maintenance', employee_id: null, assigned_date: null,       condition: 'صيانة' },
  { id: 'a7', type: 'key',     brand: 'مفتاح مكتب 3',      serial: 'KY-001',      status: 'assigned', employee_id: 'e5',  assigned_date: '2024-03-01', condition: 'ممتاز' },
  { id: 'a8', type: 'laptop',  brand: 'HP EliteBook',       serial: 'HP-2024-006', status: 'assigned', employee_id: 'e6',  assigned_date: '2024-02-15', condition: 'جيد' },
];

export default function AssetsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    accent:    '#4A7AAB',
  };

  const [assets, setAssets]           = useState(MOCK_ASSETS);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal]     = useState(false);
  const [editAsset, setEditAsset]     = useState(null);
  const [form, setForm]               = useState({ type: 'laptop', brand: '', serial: '', status: 'available', employee_id: '', condition: 'جيد' });

  const empMap = Object.fromEntries(MOCK_EMPLOYEES.map(e => [e.id, e]));

  const filtered = assets.filter(a => {
    const emp = a.employee_id ? empMap[a.employee_id] : null;
    const matchSearch = !search ||
      a.brand.toLowerCase().includes(search.toLowerCase()) ||
      a.serial.toLowerCase().includes(search.toLowerCase()) ||
      (emp && emp.name.toLowerCase().includes(search.toLowerCase()));
    const matchType   = filterType   === 'all' || a.type   === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const stats = {
    total:       assets.length,
    assigned:    assets.filter(a => a.status === 'assigned').length,
    available:   assets.filter(a => a.status === 'available').length,
    maintenance: assets.filter(a => a.status === 'maintenance').length,
  };

  function openAdd() {
    setEditAsset(null);
    setForm({ type: 'laptop', brand: '', serial: '', status: 'available', employee_id: '', condition: 'جيد' });
    setShowModal(true);
  }

  function openEdit(asset) {
    setEditAsset(asset);
    setForm({ type: asset.type, brand: asset.brand, serial: asset.serial, status: asset.status, employee_id: asset.employee_id || '', condition: asset.condition });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.brand || !form.serial) return;
    if (editAsset) {
      setAssets(prev => prev.map(a => a.id === editAsset.id ? {
        ...a, ...form, employee_id: form.employee_id || null,
        assigned_date: form.status === 'assigned' && form.employee_id ? (a.assigned_date || new Date().toISOString().slice(0,10)) : null
      } : a));
    } else {
      setAssets(prev => [...prev, {
        id: 'a' + Date.now(), ...form,
        employee_id: form.employee_id || null,
        assigned_date: form.status === 'assigned' && form.employee_id ? new Date().toISOString().slice(0,10) : null,
      }]);
    }
    setShowModal(false);
  }

  function handleDelete(id) {
    setAssets(prev => prev.filter(a => a.id !== id));
  }

  const TypeIcon = ({ type, size = 16 }) => {
    const t = ASSET_TYPES.find(x => x.key === type);
    if (!t) return null;
    const Icon = t.icon;
    return <Icon size={size} color={t.color} />;
  };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: c.text, margin: 0 }}>
            {lang === 'ar' ? '📦 إدارة الأصول' : '📦 Assets Management'}
          </h1>
          <p style={{ color: c.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            {lang === 'ar' ? 'تتبع الأجهزة والمعدات المخصصة للموظفين' : 'Track devices and equipment assigned to employees'}
          </p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: c.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={15} />
          {lang === 'ar' ? 'أصل جديد' : 'New Asset'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: lang === 'ar' ? 'إجمالي الأصول' : 'Total Assets', value: stats.total, color: '#4A7AAB', icon: '📦' },
          { label: lang === 'ar' ? 'معيّنة' : 'Assigned', value: stats.assigned, color: '#10B981', icon: '✅' },
          { label: lang === 'ar' ? 'متاحة' : 'Available', value: stats.available, color: '#3B82F6', icon: '🟢' },
          { label: lang === 'ar' ? 'صيانة' : 'Maintenance', value: stats.maintenance, color: '#F59E0B', icon: '🔧' },
        ].map((s, i) => (
          <div key={i} style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px', textAlign: isRTL ? 'right' : 'left' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '4px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: c.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, color: c.textMuted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
            style={{ width: '100%', padding: isRTL ? '8px 32px 8px 12px' : '8px 12px 8px 32px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr' }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13 }}>
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          {ASSET_TYPES.map(t => <option key={t.key} value={t.key}>{lang === 'ar' ? t.ar : t.en}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13 }}>
          <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
          {Object.entries(ASSET_STATUS).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[
                lang === 'ar' ? 'النوع' : 'Type',
                lang === 'ar' ? 'الجهاز/الأصل' : 'Asset',
                lang === 'ar' ? 'السيريال' : 'Serial',
                lang === 'ar' ? 'الحالة' : 'Status',
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'تاريخ التعيين' : 'Assigned Date',
                lang === 'ar' ? 'الحالة الفعلية' : 'Condition',
                '',
              ].map((h, i) => (
                <th key={i} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: isRTL ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((asset, idx) => {
              const emp = asset.employee_id ? empMap[asset.employee_id] : null;
              const st  = ASSET_STATUS[asset.status];
              const tp  = ASSET_TYPES.find(t => t.key === asset.type);
              return (
                <tr key={asset.id} style={{ borderTop: '1px solid ' + c.border, background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <TypeIcon type={asset.type} size={16} />
                      <span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? tp?.ar : tp?.en}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: c.text }}>{asset.brand}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: c.textMuted, fontFamily: 'monospace' }}>{asset.serial}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                      {lang === 'ar' ? st.ar : st.en}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: c.text }}>
                    {emp ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#4A7AAB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>
                          {emp.name.charAt(0)}
                        </div>
                        <span style={{ fontSize: 12 }}>{emp.name}</span>
                      </div>
                    ) : <span style={{ color: c.textMuted, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: c.textMuted }}>{asset.assigned_date || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: c.textMuted }}>{asset.condition}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
                      <button onClick={() => openEdit(asset)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.textMuted }}>
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(asset.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #EF444430', background: 'transparent', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: c.textMuted }}>
            <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p>{lang === 'ar' ? 'لا توجد أصول' : 'No assets found'}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: c.cardBg, borderRadius: 14, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <h3 style={{ margin: 0, color: c.text, fontSize: 16, fontWeight: 700 }}>
                {editAsset ? (lang === 'ar' ? 'تعديل الأصل' : 'Edit Asset') : (lang === 'ar' ? 'أصل جديد' : 'New Asset')}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: lang === 'ar' ? 'النوع' : 'Type', field: 'type', type: 'select', options: ASSET_TYPES.map(t => ({ value: t.key, label: lang === 'ar' ? t.ar : t.en })) },
                { label: lang === 'ar' ? 'الاسم/الماركة' : 'Brand/Name', field: 'brand', type: 'text' },
                { label: lang === 'ar' ? 'السيريال' : 'Serial Number', field: 'serial', type: 'text' },
                { label: lang === 'ar' ? 'الحالة' : 'Status', field: 'status', type: 'select', options: Object.entries(ASSET_STATUS).map(([k,v]) => ({ value: k, label: lang === 'ar' ? v.ar : v.en })) },
                { label: lang === 'ar' ? 'الموظف' : 'Employee', field: 'employee_id', type: 'select', options: [{ value: '', label: lang === 'ar' ? '— بدون تعيين —' : '— Unassigned —' }, ...MOCK_EMPLOYEES.map(e => ({ value: e.id, label: e.name }))] },
                { label: lang === 'ar' ? 'الحالة الفعلية' : 'Condition', field: 'condition', type: 'text' },
              ].map(({ label, field, type, options }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{label}</label>
                  {type === 'select' ? (
                    <select value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, direction: isRTL ? 'rtl' : 'ltr' }}>
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr' }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid ' + c.border, background: 'transparent', color: c.text, fontSize: 13, cursor: 'pointer' }}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSave} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: c.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} />
                {lang === 'ar' ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
