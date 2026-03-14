import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { getFieldsByEntity, getFieldValues, setFieldValues } from '../../services/customFieldsService';

/**
 * CustomFieldsRenderer – Reusable component to render custom fields for an entity.
 *
 * Props:
 *   entity    - 'contact' | 'deal' | 'opportunity'
 *   entityId  - string (record id)
 *   mode      - 'view' | 'edit'
 *   onChange  - (fieldValues: {[fieldId]: value}) => void — called on every edit change
 *   values    - optional externally-controlled values (for new records without an id yet)
 *   defaultCollapsed - boolean (default true)
 */
export default function CustomFieldsRenderer({ entity, entityId, mode = 'view', onChange, values: externalValues, defaultCollapsed = true }) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [localValues, setLocalValues] = useState({});

  const fields = useMemo(() => getFieldsByEntity(entity), [entity]);

  // Load saved values
  useEffect(() => {
    if (externalValues) {
      setLocalValues(externalValues);
    } else if (entityId) {
      setLocalValues(getFieldValues(entity, entityId));
    }
  }, [entity, entityId, externalValues]);

  if (fields.length === 0) return null;

  const handleChange = (fieldId, value) => {
    const next = { ...localValues, [fieldId]: value };
    setLocalValues(next);
    if (onChange) onChange(next);
    // Auto-save when editing existing record
    if (mode === 'edit' && entityId && !externalValues) {
      setFieldValues(entity, entityId, { [fieldId]: value });
    }
  };

  const label = (f) => isRTL ? (f.field_name_ar || f.field_name) : f.field_name;

  const sectionBg = isDark ? '#132337' : '#f8fafc';
  const sectionBorder = isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)';
  const headerBg = isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1a2332' : '#ffffff';
  const inputBorder = isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.12)';

  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 8,
    border: `1px solid ${inputBorder}`,
    backgroundColor: inputBg,
    color: textPrimary,
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const renderField = (field) => {
    const val = localValues[field.id] ?? field.default_value ?? '';

    if (mode === 'view') {
      let displayVal = val;
      if (field.field_type === 'checkbox') {
        displayVal = val ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No');
      } else if (field.field_type === 'select' && field.options?.length) {
        const opt = field.options.find(o => o.value === val);
        displayVal = opt ? (isRTL ? (opt.label_ar || opt.label) : opt.label) : val;
      } else if (field.field_type === 'url' && val) {
        displayVal = (
          <a href={val} target="_blank" rel="noopener noreferrer" style={{ color: '#4A7AAB', textDecoration: 'none', fontSize: 12 }}>
            {val}
          </a>
        );
      }
      if (!val && val !== 0 && val !== false) displayVal = '—';

      return (
        <div key={field.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : 'rgba(0,0,0,0.04)'}`, fontSize: 12 }}>
          <span style={{ color: textMuted }}>{label(field)}{field.required ? ' *' : ''}</span>
          <span style={{ color: textPrimary, fontWeight: 500, maxWidth: '55%', textAlign: 'end', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayVal}</span>
        </div>
      );
    }

    // Edit mode
    return (
      <div key={field.id} style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>
          {label(field)}{field.required ? <span style={{ color: '#EF4444' }}> *</span> : ''}
        </label>
        {field.field_type === 'text' && (
          <input type="text" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} />
        )}
        {field.field_type === 'number' && (
          <input type="number" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} />
        )}
        {field.field_type === 'date' && (
          <input type="date" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} />
        )}
        {field.field_type === 'email' && (
          <input type="email" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} />
        )}
        {field.field_type === 'phone' && (
          <input type="tel" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} dir="ltr" />
        )}
        {field.field_type === 'url' && (
          <input type="url" value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle} dir="ltr" placeholder="https://" />
        )}
        {field.field_type === 'select' && (
          <select value={val} onChange={e => handleChange(field.id, e.target.value)} style={inputStyle}>
            <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
            {(field.options || []).map(o => (
              <option key={o.value} value={o.value}>{isRTL ? (o.label_ar || o.label) : o.label}</option>
            ))}
          </select>
        )}
        {field.field_type === 'checkbox' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: textPrimary }}>
            <input
              type="checkbox"
              checked={!!val}
              onChange={e => handleChange(field.id, e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#4A7AAB' }}
            />
            {val ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')}
          </label>
        )}
      </div>
    );
  };

  const CollapseIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${sectionBorder}`, overflow: 'hidden', marginTop: 12, backgroundColor: sectionBg }}>
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: headerBg,
          border: 'none',
          borderBottom: collapsed ? 'none' : `1px solid ${sectionBorder}`,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Layers size={13} style={{ color: '#4A7AAB' }} />
        <span style={{ flex: 1, textAlign: 'start', fontSize: 11, fontWeight: 700, color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {isRTL ? 'حقول مخصصة' : 'Custom Fields'}
        </span>
        <span style={{ fontSize: 10, color: textMuted }}>{fields.length}</span>
        <CollapseIcon size={14} style={{ color: textMuted }} />
      </button>

      {/* Fields Body */}
      {!collapsed && (
        <div style={{ padding: mode === 'edit' ? '12px 14px' : '4px 14px 8px 14px' }}>
          {fields.map(renderField)}
        </div>
      )}
    </div>
  );
}
