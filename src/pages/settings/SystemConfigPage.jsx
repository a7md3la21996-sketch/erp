import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { useToast } from '../../contexts/ToastContext';
import { ROLES, ROLE_LABELS, ROLE_PERMISSIONS, P } from '../../config/roles';
import { hexToRgbaBg } from '../../utils/configHelpers';
import { Card, Button, Input, Select, FilterPill } from '../../components/ui';
import {
  Settings, Users, GitBranch, Building2, Briefcase, Shield,
  GripVertical, Plus, X, Trash2, RotateCcw, Save,
  ChevronDown, ChevronUp, ThumbsDown, Zap, SlidersHorizontal,
} from 'lucide-react';

// ─── Tab: Contact Types ───────────────────────────────────────────────
function ContactTypesTab({ config, updateSection, isRTL, toast }) {
  const [types, setTypes] = useState(() => [...(config.contactTypes || [])]);
  const [newType, setNewType] = useState({ label_ar: '', label_en: '', color: '#6366f1', departments: [] });

  const handleChange = (idx, field, value) => {
    setTypes(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleColorChange = (idx, color) => {
    setTypes(prev => prev.map((t, i) => i === idx ? { ...t, color, bg: hexToRgbaBg(color) } : t));
  };

  const DEPT_OPTIONS = [
    { key: 'sales', ar: 'المبيعات', en: 'Sales' },
    { key: 'hr', ar: 'الموارد البشرية', en: 'HR' },
    { key: 'marketing', ar: 'التسويق', en: 'Marketing' },
    { key: 'finance', ar: 'المالية', en: 'Finance' },
    { key: 'operations', ar: 'العمليات', en: 'Operations' },
  ];

  const toggleDept = (idx, dept) => {
    setTypes(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      const depts = t.departments || [];
      return { ...t, departments: depts.includes(dept) ? depts.filter(d => d !== dept) : [...depts, dept] };
    }));
  };

  const handleAdd = () => {
    if (!newType.label_en.trim()) return;
    const key = newType.label_en.toLowerCase().replace(/\s+/g, '_');
    setTypes(prev => [...prev, { key, ...newType, bg: hexToRgbaBg(newType.color) }]);
    setNewType({ label_ar: '', label_en: '', color: '#6366f1', departments: [] });
  };

  const handleDelete = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذا النوع؟' : 'Delete this type?')) return;
    setTypes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateSection('contactTypes', types);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'أنواع جهات الاتصال' : 'Contact Types'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        {types.map((type, idx) => (
          <div key={type.key || idx} className="p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg">
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={type.color || '#6366f1'}
                onChange={e => handleColorChange(idx, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
              />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={type.label_en} onChange={e => handleChange(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
                <Input value={type.label_ar} onChange={e => handleChange(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
              </div>
              <span
                className="text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
                style={{ color: type.color, backgroundColor: type.bg || hexToRgbaBg(type.color || '#6366f1') }}
              >
                {isRTL ? type.label_ar || 'معاينة' : type.label_en || 'Preview'}
              </span>
              <Button variant="danger" size="sm" onClick={() => handleDelete(idx)} className="!p-1.5">
                <X size={14} />
              </Button>
            </div>
            <div className="flex gap-1 flex-wrap mt-2 ps-10">
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark me-1">{isRTL ? 'الأقسام:' : 'Depts:'}</span>
              {DEPT_OPTIONS.map(d => {
                const active = (type.departments || []).includes(d.key);
                return (
                  <button key={d.key} onClick={() => toggleDept(idx, d.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-colors ${active ? 'bg-brand-500/15 border-brand-500/30 text-brand-500 font-semibold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                    {isRTL ? d.ar : d.en}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة نوع جديد' : '+ Add New Type'}
        </p>
        <div className="grid grid-cols-[32px_1fr_1fr_auto] gap-2 items-center">
          <input
            type="color"
            value={newType.color}
            onChange={e => setNewType(p => ({ ...p, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <Input value={newType.label_en} onChange={e => setNewType(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
          <Input value={newType.label_ar} onChange={e => setNewType(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newType.label_en.trim() || (newType.departments || []).length === 0} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
        <div className="flex gap-1 flex-wrap mt-2.5 items-center">
          <span className="text-[10px] text-content-muted dark:text-content-muted-dark me-1">{isRTL ? 'الأقسام:' : 'Depts:'} <span className="text-red-500">*</span></span>
          {DEPT_OPTIONS.map(d => {
            const active = (newType.departments || []).includes(d.key);
            return (
              <button key={d.key} onClick={() => setNewType(p => ({ ...p, departments: active ? p.departments.filter(x => x !== d.key) : [...(p.departments || []), d.key] }))}
                className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-colors ${active ? 'bg-brand-500/15 border-brand-500/30 text-brand-500 font-semibold' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                {isRTL ? d.ar : d.en}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Sources ─────────────────────────────────────────────────────
function SourcesTab({ config, updateSection, isRTL, toast }) {
  const [sources, setSources] = useState(() => [...(config.sources || [])]);
  const [newSource, setNewSource] = useState({ label_ar: '', label_en: '', platform: 'other' });

  const platformOptions = [
    { value: 'meta', label: 'Meta' },
    { value: 'google', label: 'Google' },
    { value: 'organic', label: isRTL ? 'عضوي' : 'Organic' },
    { value: 'direct', label: isRTL ? 'مباشر' : 'Direct' },
    { value: 'other', label: isRTL ? 'أخرى' : 'Other' },
  ];

  const handleChange = (idx, field, value) => {
    setSources(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleAdd = () => {
    if (!newSource.label_en.trim()) return;
    const key = newSource.label_en.toLowerCase().replace(/\s+/g, '_');
    setSources(prev => [...prev, { key, ...newSource }]);
    setNewSource({ label_ar: '', label_en: '', platform: 'other' });
  };

  const handleDelete = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذا المصدر؟' : 'Delete this source?')) return;
    setSources(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateSection('sources', sources);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'المصادر' : 'Sources'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        {sources.map((src, idx) => (
          <div key={src.key || idx} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input value={src.label_en} onChange={e => handleChange(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
              <Input value={src.label_ar} onChange={e => handleChange(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
              <Select value={src.platform} onChange={e => handleChange(idx, 'platform', e.target.value)} size="sm">
                {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(idx)} className="!p-1.5">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة مصدر جديد' : '+ Add New Source'}
        </p>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
          <Input value={newSource.label_en} onChange={e => setNewSource(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
          <Input value={newSource.label_ar} onChange={e => setNewSource(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
          <Select value={newSource.platform} onChange={e => setNewSource(p => ({ ...p, platform: e.target.value }))} size="sm">
            {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newSource.label_en.trim()} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Pipeline Stages ─────────────────────────────────────────────
function PipelineStagesTab({ config, updateSection, isRTL, toast }) {
  const depts = config.departments || [];
  const allStages = config.pipelineStages || {};
  const [selectedDept, setSelectedDept] = useState(depts[0]?.key || '');
  const [stages, setStages] = useState(() => [...(allStages[selectedDept] || [])]);
  const [dragIdx, setDragIdx] = useState(null);
  const [newStage, setNewStage] = useState({ label_ar: '', label_en: '', color: '#6366f1' });

  const switchDept = (key) => {
    setSelectedDept(key);
    setStages([...(allStages[key] || [])]);
  };

  const handleChange = (idx, field, value) => {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleColorChange = (idx, color) => {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, color, bg: hexToRgbaBg(color) } : s));
  };

  const handleAdd = () => {
    if (!newStage.label_en.trim()) return;
    const key = newStage.label_en.toLowerCase().replace(/\s+/g, '_');
    setStages(prev => [...prev, { key, ...newStage, bg: hexToRgbaBg(newStage.color) }]);
    setNewStage({ label_ar: '', label_en: '', color: '#6366f1' });
  };

  const handleDelete = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذه المرحلة؟' : 'Delete this stage?')) return;
    setStages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateSection('pipelineStages', { ...allStages, [selectedDept]: stages });
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  // Drag-to-reorder
  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    setStages(prev => {
      const arr = [...prev];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(dropIdx, 0, item);
      return arr;
    });
    setDragIdx(null);
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'مراحل البيع' : 'Pipeline Stages'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      {/* Department selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {depts.map(d => (
          <FilterPill
            key={d.key}
            label={isRTL ? d.label_ar : d.label_en}
            active={selectedDept === d.key}
            onClick={() => switchDept(d.key)}
            count={allStages[d.key]?.length}
          />
        ))}
      </div>

      {!selectedDept ? (
        <p className="text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'اختر قسم' : 'Select a department'}</p>
      ) : (
        <>
          <div className="mb-4 space-y-2">
            {stages.map((stage, idx) => (
              <div
                key={stage.key || idx}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(idx)}
                className={`flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg cursor-grab ${dragIdx === idx ? 'opacity-50' : ''}`}
              >
                <GripVertical size={16} className="text-content-muted dark:text-content-muted-dark flex-shrink-0" />
                <input
                  type="color"
                  value={stage.color || '#6366f1'}
                  onChange={e => handleColorChange(idx, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={stage.label_en} onChange={e => handleChange(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
                  <Input value={stage.label_ar} onChange={e => handleChange(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDelete(idx)} className="!p-1.5">
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>

          <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
            <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
              {isRTL ? '+ إضافة مرحلة جديدة' : '+ Add New Stage'}
            </p>
            <div className="grid grid-cols-[32px_1fr_1fr_auto] gap-2 items-center">
              <input
                type="color"
                value={newStage.color}
                onChange={e => setNewStage(p => ({ ...p, color: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
              />
              <Input value={newStage.label_en} onChange={e => setNewStage(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
              <Input value={newStage.label_ar} onChange={e => setNewStage(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
              <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newStage.label_en.trim()} className="whitespace-nowrap">
                <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Tab: Departments ─────────────────────────────────────────────────
function DepartmentsTab({ config, updateSection, isRTL, toast }) {
  const [depts, setDepts] = useState(() => [...(config.departments || [])]);
  const [newDept, setNewDept] = useState({ label_ar: '', label_en: '', color: '#6366f1' });

  const handleChange = (idx, field, value) => {
    setDepts(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const handleAdd = () => {
    if (!newDept.label_en.trim()) return;
    const key = newDept.label_en.toLowerCase().replace(/\s+/g, '_');
    setDepts(prev => [...prev, { key, ...newDept }]);
    setNewDept({ label_ar: '', label_en: '', color: '#6366f1' });
  };

  const handleDelete = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذا القسم؟' : 'Delete this department?')) return;
    setDepts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateSection('departments', depts);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'الأقسام' : 'Departments'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        {depts.map((dept, idx) => (
          <div key={dept.key || idx} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg">
            <input
              type="color"
              value={dept.color || '#6366f1'}
              onChange={e => handleChange(idx, 'color', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={dept.label_en} onChange={e => handleChange(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
              <Input value={dept.label_ar} onChange={e => handleChange(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(idx)} className="!p-1.5">
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة قسم جديد' : '+ Add New Department'}
        </p>
        <div className="grid grid-cols-[32px_1fr_1fr_auto] gap-2 items-center">
          <input
            type="color"
            value={newDept.color}
            onChange={e => setNewDept(p => ({ ...p, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <Input value={newDept.label_en} onChange={e => setNewDept(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
          <Input value={newDept.label_ar} onChange={e => setNewDept(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={!newDept.label_en.trim()} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Company Info ────────────────────────────────────────────────
function CompanyInfoTab({ config, updateSection, isRTL, toast }) {
  const [info, setInfo] = useState(() => ({ ...(config.companyInfo || {}) }));

  const set = (field, value) => setInfo(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    updateSection('companyInfo', info);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  const currencyOptions = [
    { value: 'EGP', label: 'EGP - Egyptian Pound' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'SAR', label: 'SAR - Saudi Riyal' },
    { value: 'AED', label: 'AED - UAE Dirham' },
    { value: 'EUR', label: 'EUR - Euro' },
  ];

  const timezoneOptions = [
    { value: 'Africa/Cairo', label: 'Africa/Cairo (GMT+2)' },
    { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
    { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
    { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  ];

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'بيانات الشركة' : 'Company Info'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (عربي)' : 'Company Name (AR)'}</label>
          <Input value={info.name_ar || ''} onChange={e => set('name_ar', e.target.value)} dir="rtl" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'اسم الشركة (إنجليزي)' : 'Company Name (EN)'}</label>
          <Input value={info.name_en || ''} onChange={e => set('name_en', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الهاتف' : 'Phone'}</label>
          <Input value={info.phone || ''} onChange={e => set('phone', e.target.value)} type="tel" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
          <Input value={info.email || ''} onChange={e => set('email', e.target.value)} type="email" />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'العنوان (عربي)' : 'Address (AR)'}</label>
          <textarea
            value={info.address_ar || ''}
            onChange={e => set('address_ar', e.target.value)}
            dir="rtl"
            rows={3}
            className="w-full rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark p-2.5 text-sm font-cairo resize-y"
          />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'العنوان (إنجليزي)' : 'Address (EN)'}</label>
          <textarea
            value={info.address_en || ''}
            onChange={e => set('address_en', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark p-2.5 text-sm font-cairo resize-y"
          />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'رابط اللوجو' : 'Logo URL'}</label>
          <Input value={info.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'العملة' : 'Currency'}</label>
          <Select value={info.currency || 'EGP'} onChange={e => set('currency', e.target.value)}>
            {currencyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</label>
          <Select value={info.timezone || 'Africa/Cairo'} onChange={e => set('timezone', e.target.value)}>
            {timezoneOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Roles & Permissions (Read-only) ─────────────────────────────
function RolesPermissionsTab({ isRTL }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (role) => setExpanded(prev => ({ ...prev, [role]: !prev[role] }));

  return (
    <Card className="p-5">
      <h3 className="m-0 mb-4 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
        <Shield size={16} className="text-brand-500" />
        {isRTL ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
      </h3>
      <p className="m-0 mb-4 text-xs text-content-muted dark:text-content-muted-dark">
        {isRTL ? 'للعرض فقط - لا يمكن التعديل من هنا' : 'Read-only view - cannot be edited here'}
      </p>

      <div className="space-y-2">
        {Object.values(ROLES).map(role => {
          const labels = ROLE_LABELS[role];
          const perms = ROLE_PERMISSIONS[role] || [];
          const isOpen = expanded[role];

          return (
            <div key={role} className="border border-edge dark:border-edge-dark rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpand(role)}
                className="w-full flex items-center justify-between p-3 bg-surface-input dark:bg-surface-input-dark cursor-pointer border-0 text-left font-cairo"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-content dark:text-content-dark">
                    {isRTL ? labels?.ar : labels?.en}
                  </span>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">
                    ({isRTL ? labels?.en : labels?.ar})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-semibold">
                    {perms.length}
                  </span>
                </div>
                {isOpen
                  ? <ChevronUp size={16} className="text-content-muted dark:text-content-muted-dark" />
                  : <ChevronDown size={16} className="text-content-muted dark:text-content-muted-dark" />
                }
              </button>
              {isOpen && (
                <div className="p-3 flex flex-wrap gap-1.5">
                  {perms.map(p => (
                    <span key={p} className="text-[10px] px-2 py-1 rounded-full bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Tab: Lost Reasons ────────────────────────────────────────────────
function CloseReasonsTab({ config, updateSection, isRTL, toast }) {
  const [lostReasons, setLostReasons] = useState(() => [...(config.lostReasons || [])]);
  const [newLost, setNewLost] = useState({ label_ar: '', label_en: '' });

  const handleSave = () => {
    updateSection('lostReasons', lostReasons);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  const addLost = () => {
    if (!newLost.label_en.trim()) return;
    const key = newLost.label_en.toLowerCase().replace(/\s+/g, '_');
    setLostReasons(prev => [...prev, { key, ...newLost }]);
    setNewLost({ label_ar: '', label_en: '' });
  };

  const deleteLost = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذا السبب؟' : 'Delete this reason?')) return;
    setLostReasons(prev => prev.filter((_, i) => i !== idx));
  };

  const changeLost = (idx, field, value) => {
    setLostReasons(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
          <ThumbsDown size={16} className="text-red-500" />
          {isRTL ? 'أسباب الخسارة' : 'Lost Reasons'}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-semibold">
            {lostReasons.length}
          </span>
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        {lostReasons.map((r, idx) => (
          <div key={r.key || idx} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg" style={{ borderInlineStartWidth: 3, borderInlineStartColor: '#EF4444' }}>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={r.label_en} onChange={e => changeLost(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
              <Input value={r.label_ar} onChange={e => changeLost(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
            </div>
            <Button variant="danger" size="sm" onClick={() => deleteLost(idx)} className="!p-1.5">
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة سبب جديد' : '+ Add New Reason'}
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input value={newLost.label_en} onChange={e => setNewLost(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
          <Input value={newLost.label_ar} onChange={e => setNewLost(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
          <Button variant="primary" size="sm" onClick={addLost} disabled={!newLost.label_en.trim()} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Activity Types & Results ────────────────────────────────────
function ActivityTypesTab({ config, updateSection, isRTL, toast }) {
  const [types, setTypes] = useState(() => [...(config.activityTypes || [])]);
  const [results, setResults] = useState(() => JSON.parse(JSON.stringify(config.activityResults || {})));
  const [selectedType, setSelectedType] = useState(types[0]?.key || '');
  const [newType, setNewType] = useState({ label_ar: '', label_en: '' });
  const [newResult, setNewResult] = useState({ label_ar: '', label_en: '', color: '#4A7AAB' });

  const handleSave = () => {
    updateSection('activityTypes', types);
    updateSection('activityResults', results);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  const addType = () => {
    if (!newType.label_en.trim()) return;
    const key = newType.label_en.toLowerCase().replace(/\s+/g, '_');
    setTypes(prev => [...prev, { key, ...newType }]);
    setResults(prev => ({ ...prev, [key]: [] }));
    setNewType({ label_ar: '', label_en: '' });
  };

  const deleteType = (idx) => {
    if (!window.confirm(isRTL ? 'حذف هذا النوع وكل نتائجه؟' : 'Delete this type and all its results?')) return;
    const key = types[idx].key;
    setTypes(prev => prev.filter((_, i) => i !== idx));
    setResults(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (selectedType === key) setSelectedType(types[0]?.key || '');
  };

  const changeType = (idx, field, value) => {
    setTypes(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const currentResults = results[selectedType] || [];

  const addResult = () => {
    if (!newResult.label_en.trim() || !selectedType) return;
    const value = newResult.label_en.toLowerCase().replace(/\s+/g, '_');
    setResults(prev => ({ ...prev, [selectedType]: [...(prev[selectedType] || []), { value, ...newResult }] }));
    setNewResult({ label_ar: '', label_en: '', color: '#4A7AAB' });
  };

  const deleteResult = (idx) => {
    setResults(prev => ({ ...prev, [selectedType]: prev[selectedType].filter((_, i) => i !== idx) }));
  };

  const changeResult = (idx, field, value) => {
    setResults(prev => ({ ...prev, [selectedType]: prev[selectedType].map((r, i) => i === idx ? { ...r, [field]: value } : r) }));
  };

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'أنواع النشاط والنتائج' : 'Activity Types & Results'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      {/* Activity Types list */}
      <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'أنواع النشاط' : 'Activity Types'}</p>
      <div className="mb-4 space-y-2">
        {types.map((t, idx) => (
          <div key={t.key || idx} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={t.label_en} onChange={e => changeType(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
              <Input value={t.label_ar} onChange={e => changeType(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-semibold">{(results[t.key] || []).length} {isRTL ? 'نتيجة' : 'results'}</span>
            <Button variant="danger" size="sm" onClick={() => deleteType(idx)} className="!p-1.5">
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new type */}
      <div className="p-3 mb-6 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
        <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
          {isRTL ? '+ إضافة نوع نشاط' : '+ Add Activity Type'}
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input value={newType.label_en} onChange={e => setNewType(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
          <Input value={newType.label_ar} onChange={e => setNewType(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
          <Button variant="primary" size="sm" onClick={addType} disabled={!newType.label_en.trim()} className="whitespace-nowrap">
            <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Results per type */}
      <div className="border-t border-edge dark:border-edge-dark pt-4">
        <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">{isRTL ? 'النتائج حسب النوع' : 'Results by Type'}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {types.map(t => (
            <FilterPill key={t.key} label={isRTL ? t.label_ar : t.label_en} active={selectedType === t.key} onClick={() => setSelectedType(t.key)} count={results[t.key]?.length} />
          ))}
        </div>

        {selectedType && (
          <>
            <div className="mb-4 space-y-2">
              {currentResults.map((r, idx) => (
                <div key={r.value || idx} className="flex items-center gap-2.5 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg" style={{ borderInlineStartWidth: 3, borderInlineStartColor: r.color || '#4A7AAB' }}>
                  <input type="color" value={r.color || '#4A7AAB'} onChange={e => changeResult(idx, 'color', e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={r.label_en} onChange={e => changeResult(idx, 'label_en', e.target.value)} placeholder="English" size="sm" />
                    <Input value={r.label_ar} onChange={e => changeResult(idx, 'label_ar', e.target.value)} placeholder="عربي" dir="rtl" size="sm" />
                  </div>
                  <Button variant="danger" size="sm" onClick={() => deleteResult(idx)} className="!p-1.5">
                    <X size={14} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-3 bg-surface-input dark:bg-surface-input-dark border border-dashed border-edge dark:border-edge-dark rounded-lg">
              <p className="m-0 mb-2.5 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? '+ إضافة نتيجة' : '+ Add Result'}
              </p>
              <div className="grid grid-cols-[32px_1fr_1fr_auto] gap-2 items-center">
                <input type="color" value={newResult.color} onChange={e => setNewResult(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                <Input value={newResult.label_en} onChange={e => setNewResult(p => ({ ...p, label_en: e.target.value }))} placeholder="English" size="sm" />
                <Input value={newResult.label_ar} onChange={e => setNewResult(p => ({ ...p, label_ar: e.target.value }))} placeholder="عربي" dir="rtl" size="sm" />
                <Button variant="primary" size="sm" onClick={addResult} disabled={!newResult.label_en.trim()} className="whitespace-nowrap">
                  <Plus size={13} /> {isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Tab: Contacts Settings ──────────────────────────────────────────
function ContactsSettingsTab({ config, updateSection, isRTL, toast }) {
  const [settings, setSettings] = useState(() => ({ mergeLimit: 2, maxPins: 5, ...(config.contactsSettings || {}) }));

  // Privacy toggle: stored in system_config root level
  const [hideHistory, setHideHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('platform_system_config') || '{}').hide_previous_agent_history === true; } catch { return false; }
  });

  const handleSave = () => {
    updateSection('contactsSettings', settings);
    // Save privacy toggle to root config
    try {
      const cfg = JSON.parse(localStorage.getItem('platform_system_config') || '{}');
      cfg.hide_previous_agent_history = hideHistory;
      localStorage.setItem('platform_system_config', JSON.stringify(cfg));
    } catch {}
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  const fields = [
    { key: 'mergeLimit', label_ar: 'الحد الأقصى لدمج جهات الاتصال', label_en: 'Max contacts to merge at once', min: 2, max: 10, desc_ar: 'عدد جهات الاتصال اللي ممكن تدمجهم مع بعض', desc_en: 'How many contacts can be merged together' },
    { key: 'maxPins', label_ar: 'الحد الأقصى للتثبيت', label_en: 'Max pinned contacts', min: 1, max: 20, desc_ar: 'عدد جهات الاتصال اللي ممكن تثبتهم فوق', desc_en: 'How many contacts can be pinned at the top' },
  ];

  return (
    <Card>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{isRTL ? 'إعدادات جهات الاتصال' : 'Contacts Settings'}</h3>
          <Button size="sm" onClick={handleSave}><Save size={13} /> {isRTL ? 'حفظ' : 'Save'}</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{isRTL ? f.label_ar : f.label_en}</div>
                <div className="text-content-muted dark:text-content-muted-dark" style={{ fontSize: 11 }}>{isRTL ? f.desc_ar : f.desc_en}</div>
              </div>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                value={settings[f.key]}
                onChange={e => setSettings(s => ({ ...s, [f.key]: Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.min)) }))}
                style={{ width: 80, textAlign: 'center' }}
              />
            </div>
          ))}

          {/* Privacy: Hide previous agent history */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--edge, #e2e8f0)' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                {isRTL ? 'إخفاء سجل الأنشطة السابقة عند إعادة التعيين' : 'Hide previous agent history on reassignment'}
              </div>
              <div className="text-content-muted dark:text-content-muted-dark" style={{ fontSize: 11 }}>
                {isRTL
                  ? 'لما contact يتعين لسيلز جديد، الأنشطة القديمة هتتخفى عنه (المدير يشوف كل حاجة)'
                  : 'When a contact is reassigned, the new agent won\'t see previous activities (managers see everything)'}
              </div>
            </div>
            <button
              onClick={() => setHideHistory(h => !h)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: hideHistory ? '#4A7AAB' : '#e2e8f0',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                [hideHistory ? 'right' : 'left']: 3,
                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab: Stage Win Rates ─────────────────────────────────────────────
function StageWinRatesTab({ config, updateSection, isRTL, toast }) {
  const depts = config.departments || [];
  const allStages = config.pipelineStages || {};
  const [rates, setRates] = useState(() => ({ ...(config.stageWinRates || {}) }));
  const [selectedDept, setSelectedDept] = useState(depts[0]?.key || '');

  const switchDept = (key) => setSelectedDept(key);

  const stages = allStages[selectedDept] || [];

  const handleChange = (stageId, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setRates(prev => ({
      ...prev,
      [selectedDept]: { ...(prev[selectedDept] || {}), [stageId]: num },
    }));
  };

  const handleSave = () => {
    updateSection('stageWinRates', rates);
    toast.success(isRTL ? 'تم الحفظ' : 'Saved');
  };

  const deptRates = rates[selectedDept] || {};

  return (
    <Card className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-sm font-bold text-content dark:text-content-dark">
          {isRTL ? 'نسب الفوز بالمراحل' : 'Stage Win Rates'}
        </h3>
        <Button variant="primary" size="sm" onClick={handleSave}>
          <Save size={13} /> {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>

      <p className="text-[11px] text-content-muted dark:text-content-muted-dark mb-4 m-0">
        {isRTL ? 'تُستخدم لحساب التوقع المرجح (الميزانية × نسبة الفوز). أدخل نسبة مئوية (0-100) لكل مرحلة.' : 'Used for Weighted Pipeline Forecast (budget × win rate). Enter a percentage (0-100) for each stage.'}
      </p>

      {/* Department selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {depts.map(d => (
          <FilterPill
            key={d.key}
            label={isRTL ? d.label_ar : d.label_en}
            active={selectedDept === d.key}
            onClick={() => switchDept(d.key)}
          />
        ))}
      </div>

      <div className="space-y-2">
        {stages.map(stage => (
          <div key={stage.id} className="flex items-center gap-3 p-2.5 bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
            <span className="flex-1 text-xs font-semibold text-content dark:text-content-dark">
              {isRTL ? stage.label_ar : stage.label_en}
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={deptRates[stage.id] ?? ''}
                onChange={e => handleChange(stage.id, e.target.value)}
                placeholder="0"
                className="w-[70px] text-center text-xs font-semibold px-2 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-white dark:bg-surface-card-dark text-content dark:text-content-dark outline-none"
              />
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark">%</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
const TABS = [
  { key: 'contactTypes', icon: Users, ar: 'أنواع جهات الاتصال', en: 'Contact Types' },
  { key: 'sources', icon: GitBranch, ar: 'المصادر', en: 'Sources' },
  { key: 'pipeline', icon: GitBranch, ar: 'مراحل البيع', en: 'Pipeline Stages' },
  { key: 'departments', icon: Building2, ar: 'الأقسام', en: 'Departments' },
  { key: 'activityTypes', icon: Zap, ar: 'أنواع النشاط', en: 'Activity Types' },
  { key: 'closeReasons', icon: ThumbsDown, ar: 'أسباب الخسارة', en: 'Lost Reasons' },
  { key: 'stageWinRates', icon: SlidersHorizontal, ar: 'نسب الفوز', en: 'Stage Win Rates' },
  { key: 'contactsSettings', icon: SlidersHorizontal, ar: 'إعدادات جهات الاتصال', en: 'Contacts Settings' },
  { key: 'company', icon: Briefcase, ar: 'بيانات الشركة', en: 'Company Info' },
  { key: 'roles', icon: Shield, ar: 'الأدوار والصلاحيات', en: 'Roles & Permissions' },
];

export default function SystemConfigPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const { config, updateSection, resetToDefaults } = useSystemConfig();

  const [activeTab, setActiveTab] = useState('contactTypes');

  // Admin gate
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

  const handleResetAll = () => {
    const msg = isRTL
      ? 'تحذير: سيتم إعادة جميع الإعدادات للقيم الافتراضية. هل أنت متأكد؟'
      : 'Warning: This will reset ALL settings to defaults. Are you sure?';
    if (!window.confirm(msg)) return;
    if (!window.confirm(isRTL ? 'تأكيد نهائي - لا يمكن التراجع!' : 'Final confirmation - this cannot be undone!')) return;
    resetToDefaults();
    toast.success(isRTL ? 'تم إعادة التعيين' : 'Reset to defaults');
    window.location.reload();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'contactTypes':
        return <ContactTypesTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'sources':
        return <SourcesTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'pipeline':
        return <PipelineStagesTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'departments':
        return <DepartmentsTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'activityTypes':
        return <ActivityTypesTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'closeReasons':
        return <CloseReasonsTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'stageWinRates':
        return <StageWinRatesTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'contactsSettings':
        return <ContactsSettingsTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'company':
        return <CompanyInfoTab config={config} updateSection={updateSection} isRTL={isRTL} toast={toast} />;
      case 'roles':
        return <RolesPermissionsTab isRTL={isRTL} />;
      default:
        return null;
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Settings size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'إعدادات النظام' : 'System Config'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'تخصيص إعدادات وبيانات النظام' : 'Customize system settings & data'}
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleResetAll} className="whitespace-nowrap">
          <RotateCcw size={13} /> {isRTL ? 'إعادة تعيين الكل' : 'Reset All'}
        </Button>
      </div>

      {/* Tab Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(tab => (
          <FilterPill
            key={tab.key}
            label={isRTL ? tab.ar : tab.en}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          />
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-[900px]">
        {renderTab()}
      </div>
    </div>
  );
}
