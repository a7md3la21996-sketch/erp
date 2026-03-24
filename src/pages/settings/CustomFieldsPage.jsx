import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Layers, Plus, Pencil, Trash2, X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { SmartFilter, applySmartFilters, Pagination } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { logAction } from '../../services/auditService';
import {
  getFields, addField, updateField, deleteField,
} from '../../services/customFieldsService';

// ── Constants ─────────────────────────────────────────────────────────
const ENTITY_OPTIONS = [
  { value: 'contact', ar: 'جهة اتصال', en: 'Contact' },
  { value: 'deal', ar: 'صفقة', en: 'Deal' },
  { value: 'opportunity', ar: 'فرصة', en: 'Opportunity' },
];

const TYPE_OPTIONS = [
  { value: 'text', ar: 'نص', en: 'Text' },
  { value: 'number', ar: 'رقم', en: 'Number' },
  { value: 'date', ar: 'تاريخ', en: 'Date' },
  { value: 'select', ar: 'قائمة اختيار', en: 'Select' },
  { value: 'checkbox', ar: 'خانة اختيار', en: 'Checkbox' },
  { value: 'url', ar: 'رابط', en: 'URL' },
  { value: 'email', ar: 'بريد إلكتروني', en: 'Email' },
  { value: 'phone', ar: 'هاتف', en: 'Phone' },
];

const SMART_FIELDS = [
  { id: 'entity', label: 'الكيان', labelEn: 'Entity', type: 'select', options: ENTITY_OPTIONS.map(o => ({ value: o.value, label: o.ar, labelEn: o.en })) },
  { id: 'field_type', label: 'النوع', labelEn: 'Type', type: 'select', options: TYPE_OPTIONS.map(o => ({ value: o.value, label: o.ar, labelEn: o.en })) },
];

const emptyForm = {
  entity: 'contact',
  field_name: '',
  field_name_ar: '',
  field_type: 'text',
  options: [],
  required: false,
  default_value: '',
  sort_order: 0,
};

// ── Main Component ───────────────────────────────────────────────────
export default function CustomFieldsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const { auditFields, applyAuditFilters } = useAuditFilter('custom_field');

  const [fields, setFields] = useState([]);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Option builder state
  const [optionDraft, setOptionDraft] = useState({ label: '', label_ar: '' });

  const loadFields = async () => {
    const result = await getFields();
    setFields(Array.isArray(result) ? result : []);
  };
  useEffect(() => { loadFields(); }, []);

  const allSmartFields = useMemo(() => [...SMART_FIELDS, ...auditFields], [auditFields]);

  // Filter + search
  const filtered = useMemo(() => {
    let result = [...fields];
    result = applySmartFilters(result, smartFilters, allSmartFields);
    result = applyAuditFilters(result, smartFilters);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        (f.field_name || '').toLowerCase().includes(q) ||
        (f.field_name_ar || '').toLowerCase().includes(q) ||
        (f.entity || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => (a.entity || '').localeCompare(b.entity || '') || (a.sort_order || 0) - (b.sort_order || 0));
    return result;
  }, [fields, smartFilters, search, allSmartFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [smartFilters, search, pageSize]);

  // Modal helpers
  const openAdd = () => {
    setEditingField(null);
    setForm({ ...emptyForm, sort_order: fields.length });
    setOptionDraft({ label: '', label_ar: '' });
    setShowModal(true);
  };
  const openEdit = (f) => {
    setEditingField(f);
    setForm({
      entity: f.entity,
      field_name: f.field_name,
      field_name_ar: f.field_name_ar,
      field_type: f.field_type,
      options: f.options || [],
      required: f.required || false,
      default_value: f.default_value || '',
      sort_order: f.sort_order ?? 0,
    });
    setOptionDraft({ label: '', label_ar: '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingField(null); };

  const handleSave = async () => {
    if (!form.field_name.trim()) return;
    setSaving(true);
    try {
      if (editingField) {
        await updateField(editingField.id, form);
        logAction({ action: 'update', entity: 'custom_field', entityId: editingField.id, entityName: form.field_name, description: `Updated custom field: ${form.field_name}` });
      } else {
        const created = await addField(form);
        logAction({ action: 'create', entity: 'custom_field', entityId: created?.id, entityName: form.field_name, description: `Created custom field: ${form.field_name}` });
      }
      loadFields();
      closeModal();
    } finally { setSaving(false); }
  };

  const handleDelete = async (f) => {
    await deleteField(f.id);
    logAction({ action: 'delete', entity: 'custom_field', entityId: f.id, entityName: f.field_name, description: `Deleted custom field: ${f.field_name}` });
    loadFields();
    setDeleteConfirm(null);
  };

  const addOption = () => {
    if (!optionDraft.label.trim()) return;
    const value = optionDraft.label.trim().toLowerCase().replace(/\s+/g, '_');
    setForm(f => ({ ...f, options: [...f.options, { value, label: optionDraft.label.trim(), label_ar: optionDraft.label_ar.trim() || optionDraft.label.trim() }] }));
    setOptionDraft({ label: '', label_ar: '' });
  };

  const removeOption = (idx) => {
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  };

  const moveField = async (fieldObj, direction) => {
    const entityFields = fields.filter(f => f.entity === fieldObj.entity).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const idx = entityFields.findIndex(f => f.id === fieldObj.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= entityFields.length) return;
    const currentOrder = entityFields[idx].sort_order ?? idx;
    const swapOrder = entityFields[swapIdx].sort_order ?? swapIdx;
    await updateField(entityFields[idx].id, { sort_order: swapOrder });
    await updateField(entityFields[swapIdx].id, { sort_order: currentOrder });
    loadFields();
  };

  const getEntityLabel = (v) => { const o = ENTITY_OPTIONS.find(e => e.value === v); return o ? (isRTL ? o.ar : o.en) : v; };
  const getTypeLabel = (v) => { const o = TYPE_OPTIONS.find(e => e.value === v); return o ? (isRTL ? o.ar : o.en) : v; };

  // ── Styles ──────────────────────────────────────────────────────
  const cardBg = isDark ? '#0a1929' : '#ffffff';
  const cardBorder = isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const rowBorder = isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.05)';
  const hoverBg = isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.03)';
  const inputBg = isDark ? '#1a2332' : '#ffffff';
  const inputBorder = isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.12)';
  const surfaceBg = isDark ? '#0a1929' : '#f8fafc';

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${inputBorder}`,
    backgroundColor: inputBg,
    color: textPrimary,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'start',
    fontSize: 11,
    fontWeight: 600,
    color: textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${cardBorder}`,
    backgroundColor: isDark ? 'rgba(74,122,171,0.04)' : 'rgba(0,0,0,0.02)',
  };

  const tdStyle = {
    padding: '10px 16px',
    fontSize: 12,
    color: textPrimary,
    borderBottom: `1px solid ${rowBorder}`,
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '16px 28px', backgroundColor: surfaceBg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={20} style={{ color: '#4A7AAB' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textPrimary }}>{isRTL ? 'الحقول المخصصة' : 'Custom Fields'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: textMuted }}>{isRTL ? `${fields.length} حقل مخصص` : `${fields.length} custom fields`}</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: 'none', backgroundColor: '#4A7AAB', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={14} /> {isRTL ? 'إضافة حقل' : 'Add Field'}
        </button>
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={allSmartFields}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isRTL ? 'ابحث عن حقل...' : 'Search fields...'}
        resultsCount={filtered.length}
      />

      {/* Table */}
      <div style={{ borderRadius: 12, border: `1px solid ${cardBorder}`, backgroundColor: cardBg, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>{isRTL ? 'اسم الحقل' : 'Field Name'}</th>
                <th style={thStyle}>{isRTL ? 'الاسم بالعربي' : 'Arabic Name'}</th>
                <th style={thStyle}>{isRTL ? 'الكيان' : 'Entity'}</th>
                <th style={thStyle}>{isRTL ? 'النوع' : 'Type'}</th>
                <th style={thStyle}>{isRTL ? 'مطلوب' : 'Required'}</th>
                <th style={thStyle}>{isRTL ? 'الترتيب' : 'Order'}</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: textMuted }}>{isRTL ? 'لا توجد حقول مخصصة' : 'No custom fields'}</td></tr>
              ) : paged.map((f, i) => (
                <tr key={f.id} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = hoverBg} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: textMuted, width: 40 }}>{(safePage - 1) * pageSize + i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{f.field_name}</td>
                  <td style={tdStyle}>{f.field_name_ar || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, color: '#4A7AAB', backgroundColor: 'rgba(74,122,171,0.1)' }}>
                      {getEntityLabel(f.entity)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, color: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)' }}>
                      {getTypeLabel(f.field_type)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: f.required ? '#10B981' : textMuted }}>
                      {f.required ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: textMuted }}>{f.sort_order ?? 0}</span>
                      <button onClick={() => moveField(f, 'up')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: textMuted, opacity: 0.6 }} title="Move up"><ArrowUp size={12} /></button>
                      <button onClick={() => moveField(f, 'down')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: textMuted, opacity: 0.6 }} title="Move down"><ArrowDown size={12} /></button>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => openEdit(f)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(74,122,171,0.2)', backgroundColor: 'rgba(74,122,171,0.08)', color: '#4A7AAB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={12} /></button>
                      <button onClick={() => setDeleteConfirm(f)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={filtered.length}
      />

      {/* ═══ Add/Edit Modal ═══ */}
      {showModal && (
        <div onClick={closeModal} dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
                {editingField ? (isRTL ? 'تعديل حقل' : 'Edit Field') : (isRTL ? 'إضافة حقل جديد' : 'Add New Field')}
              </h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Entity */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'الكيان' : 'Entity'} <span style={{ color: '#EF4444' }}>*</span></label>
                  <select value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value }))} style={inputStyle}>
                    {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>)}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'نوع الحقل' : 'Field Type'} <span style={{ color: '#EF4444' }}>*</span></label>
                  <select value={form.field_type} onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))} style={inputStyle}>
                    {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{isRTL ? o.ar : o.en}</option>)}
                  </select>
                </div>

                {/* Field Name EN */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'اسم الحقل (إنجليزي)' : 'Field Name (EN)'} <span style={{ color: '#EF4444' }}>*</span></label>
                  <input type="text" value={form.field_name} onChange={e => setForm(f => ({ ...f, field_name: e.target.value }))} style={inputStyle} placeholder="e.g. Company Size" />
                </div>

                {/* Field Name AR */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'اسم الحقل (عربي)' : 'Field Name (AR)'}</label>
                  <input type="text" value={form.field_name_ar} onChange={e => setForm(f => ({ ...f, field_name_ar: e.target.value }))} style={inputStyle} placeholder="مثال: حجم الشركة" dir="rtl" />
                </div>

                {/* Default Value */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'القيمة الافتراضية' : 'Default Value'}</label>
                  <input type="text" value={form.default_value} onChange={e => setForm(f => ({ ...f, default_value: e.target.value }))} style={inputStyle} />
                </div>

                {/* Sort Order */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: textMuted, marginBottom: 4 }}>{isRTL ? 'ترتيب العرض' : 'Sort Order'}</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} style={inputStyle} min={0} />
                </div>

                {/* Required */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: textPrimary }}>
                    <input type="checkbox" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#4A7AAB' }} />
                    {isRTL ? 'حقل مطلوب' : 'Required field'}
                  </label>
                </div>
              </div>

              {/* Select Options Builder */}
              {form.field_type === 'select' && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: `1px solid ${inputBorder}`, backgroundColor: isDark ? '#132337' : '#f8fafc' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 10 }}>
                    {isRTL ? 'خيارات القائمة' : 'Select Options'} ({form.options.length})
                  </div>

                  {/* Existing options */}
                  {form.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', borderRadius: 8, backgroundColor: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(0,0,0,0.02)', border: `1px solid ${rowBorder}` }}>
                      <GripVertical size={12} style={{ color: textMuted, opacity: 0.4 }} />
                      <span style={{ flex: 1, fontSize: 12, color: textPrimary }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: textMuted }}>{opt.label_ar}</span>
                      <button onClick={() => removeOption(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}><X size={12} /></button>
                    </div>
                  ))}

                  {/* Add new option */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 10, color: textMuted, marginBottom: 2 }}>{isRTL ? 'الخيار (إنجليزي)' : 'Option (EN)'}</label>
                      <input type="text" value={optionDraft.label} onChange={e => setOptionDraft(d => ({ ...d, label: e.target.value }))} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && addOption()} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 10, color: textMuted, marginBottom: 2 }}>{isRTL ? 'الخيار (عربي)' : 'Option (AR)'}</label>
                      <input type="text" value={optionDraft.label_ar} onChange={e => setOptionDraft(d => ({ ...d, label_ar: e.target.value }))} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }} dir="rtl" onKeyDown={e => e.key === 'Enter' && addOption()} />
                    </div>
                    <button onClick={addOption} disabled={!optionDraft.label.trim()} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: 'none', backgroundColor: '#4A7AAB', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: optionDraft.label.trim() ? 1 : 0.4, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${cardBorder}`, backgroundColor: 'transparent', color: textMuted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSave} disabled={saving || !form.field_name.trim()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', backgroundColor: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || !form.field_name.trim()) ? 0.5 : 1 }}>
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : editingField ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation Modal ═══ */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: cardBg, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 24, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <Trash2 size={32} style={{ color: '#EF4444', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'حذف الحقل' : 'Delete Field'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: textMuted, lineHeight: 1.6 }}>
              {isRTL
                ? `هل أنت متأكد من حذف "${deleteConfirm.field_name_ar || deleteConfirm.field_name}"؟ سيتم حذف جميع القيم المرتبطة.`
                : `Are you sure you want to delete "${deleteConfirm.field_name}"? All associated values will be removed.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${cardBorder}`, backgroundColor: 'transparent', color: textMuted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', backgroundColor: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
