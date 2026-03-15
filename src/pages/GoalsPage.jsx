import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Target, Plus, ChevronDown, ChevronUp, Edit3, Trash2, X,
  CheckCircle, AlertTriangle, TrendingDown, Award, BarChart3,
  Save, ChevronRight,
} from 'lucide-react';
import { KpiCard } from '../components/ui';
import Pagination from '../components/ui/Pagination';
import SmartFilter, { applySmartFilters } from '../components/ui/SmartFilter';
import { useAuditFilter } from '../hooks/useAuditFilter';
import { logAction } from '../services/auditService';
import {
  getObjectives, createObjective, updateObjective, deleteObjective,
  updateKeyResult, computeObjectiveProgress, getQuarterSummary,
  QUARTERS, OBJ_STATUS_OPTIONS, KR_STATUS_OPTIONS, KR_UNIT_OPTIONS,
  STATUS_COLORS,
} from '../services/okrService';
import { DEPARTMENTS } from '../data/hr_mock_data';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function getCurrentQuarter() {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

/* ─── Objective Card ─── */
function ObjectiveCard({ obj, isRTL, isDark, lang, onEdit, onDelete, onUpdateKR, expanded, onToggle }) {
  const progress = computeObjectiveProgress(obj);
  const statusOpt = OBJ_STATUS_OPTIONS.find(s => s.value === obj.status);
  const statusColor = statusOpt?.color || '#94a3b8';
  const progressColor = progress >= 70 ? '#10B981' : progress >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{
      background: isDark ? '#1a2332' : '#ffffff',
      border: '1px solid ' + (isDark ? '#ffffff12' : '#e2e8f0'),
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: statusColor + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Target size={20} color={statusColor} />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? (obj.titleAr || obj.title) : obj.title}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: statusColor + '18', color: statusColor,
                border: '1px solid ' + statusColor + '35',
              }}>
                {isRTL ? statusOpt?.label_ar : statusOpt?.label_en}
              </span>
              <span style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                {obj.owner_name} &middot; {obj.department}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {/* Progress circle */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: progressColor }}>{progress}%</span>
            <p style={{ margin: 0, fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL ? 'التقدم' : 'Progress'}
            </p>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(obj); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6,
              color: isDark ? '#94a3b8' : '#64748b',
            }}>
              <Edit3 size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(obj.id); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6,
              color: '#EF4444',
            }}>
              <Trash2 size={15} />
            </button>
          </div>
          {expanded ? <ChevronUp size={18} color={isDark ? '#94a3b8' : '#64748b'} /> : <ChevronDown size={18} color={isDark ? '#94a3b8' : '#64748b'} />}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 20px', marginBottom: expanded ? 0 : 16 }}>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.12)' : '#f1f5f9' }}>
          <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', borderRadius: 3, background: progressColor, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Key Results (expanded) */}
      {expanded && (
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid ' + (isDark ? '#ffffff08' : '#f1f5f9') }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'النتائج الرئيسية' : 'Key Results'} ({obj.keyResults?.length || 0})
          </p>
          {(obj.keyResults || []).map(kr => {
            const krStatusOpt = KR_STATUS_OPTIONS.find(s => s.value === kr.status);
            const krColor = STATUS_COLORS[kr.status] || '#94a3b8';
            const krProgress = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : kr.progress || 0;
            return (
              <div key={kr.id} style={{
                padding: '10px 14px',
                marginBottom: 8,
                borderRadius: 10,
                background: isDark ? '#0a1929' : '#f8fafc',
                border: '1px solid ' + (isDark ? '#ffffff08' : '#e2e8f0'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row', flex: 1 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: krColor, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {isRTL ? (kr.titleAr || kr.title) : kr.title}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    background: krColor + '18', color: krColor,
                    border: '1px solid ' + krColor + '30',
                  }}>
                    {isRTL ? krStatusOpt?.label_ar : krStatusOpt?.label_en}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: 5, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.12)' : '#e2e8f0' }}>
                      <div style={{ width: `${Math.min(krProgress, 100)}%`, height: '100%', borderRadius: 3, background: krColor, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                  {/* Inline edit current value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="number"
                      value={kr.current}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const val = Number(e.target.value);
                        onUpdateKR(obj.id, kr.id, { current: val });
                      }}
                      style={{
                        width: 56,
                        padding: '3px 6px',
                        borderRadius: 6,
                        border: '1px solid ' + (isDark ? '#ffffff20' : '#e2e8f0'),
                        background: isDark ? '#1a2332' : '#ffffff',
                        color: isDark ? '#e2e8f0' : '#1e293b',
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                      / {kr.unit === 'currency' ? (kr.target >= 1000000 ? (kr.target / 1000000).toFixed(1) + 'M' : kr.target >= 1000 ? (kr.target / 1000).toFixed(0) + 'K' : kr.target) : kr.target}
                      {kr.unit === 'percentage' ? '%' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── New/Edit Objective Modal ─── */
function ObjectiveModal({ isOpen, onClose, onSave, editObj, isDark, isRTL, lang }) {
  const [form, setForm] = useState({
    title: '', titleAr: '', description: '', quarter: getCurrentQuarter(), year: CURRENT_YEAR,
    owner_id: '', owner_name: '', department: '', status: 'draft', keyResults: [],
  });

  useEffect(() => {
    if (editObj) {
      setForm({
        title: editObj.title || '',
        titleAr: editObj.titleAr || '',
        description: editObj.description || '',
        quarter: editObj.quarter || getCurrentQuarter(),
        year: editObj.year || CURRENT_YEAR,
        owner_id: editObj.owner_id || '',
        owner_name: editObj.owner_name || '',
        department: editObj.department || '',
        status: editObj.status || 'draft',
        keyResults: (editObj.keyResults || []).map(kr => ({ ...kr })),
      });
    } else {
      setForm({
        title: '', titleAr: '', description: '', quarter: getCurrentQuarter(), year: CURRENT_YEAR,
        owner_id: '', owner_name: '', department: '', status: 'draft',
        keyResults: [{ id: 'new_' + Date.now(), title: '', titleAr: '', target: 0, current: 0, unit: 'number', progress: 0, status: 'on_track', dueDate: '' }],
      });
    }
  }, [editObj, isOpen]);

  if (!isOpen) return null;

  const addKR = () => {
    setForm(prev => ({
      ...prev,
      keyResults: [...prev.keyResults, { id: 'new_' + Date.now(), title: '', titleAr: '', target: 0, current: 0, unit: 'number', progress: 0, status: 'on_track', dueDate: '' }],
    }));
  };

  const removeKR = (idx) => {
    setForm(prev => ({ ...prev, keyResults: prev.keyResults.filter((_, i) => i !== idx) }));
  };

  const updateKRField = (idx, field, value) => {
    setForm(prev => {
      const krs = [...prev.keyResults];
      krs[idx] = { ...krs[idx], [field]: value };
      return { ...prev, keyResults: krs };
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid ' + (isDark ? '#ffffff20' : '#e2e8f0'),
    background: isDark ? '#0a1929' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: isDark ? '#94a3b8' : '#64748b',
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
        background: isDark ? '#1a2332' : '#ffffff',
        borderRadius: 16, border: '1px solid ' + (isDark ? '#ffffff12' : '#e2e8f0'),
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid ' + (isDark ? '#ffffff10' : '#e2e8f0'),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {editObj
              ? (isRTL ? 'تعديل الهدف' : 'Edit Objective')
              : (isRTL ? 'هدف جديد' : 'New Objective')
            }
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isDark ? '#94a3b8' : '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'العنوان (EN)' : 'Title (EN)'}</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="Objective title" />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'العنوان (AR)' : 'Title (AR)'}</label>
              <input value={form.titleAr} onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))} style={inputStyle} placeholder="عنوان الهدف" dir="rtl" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{isRTL ? 'الوصف' : 'Description'}</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الربع' : 'Quarter'}</label>
              <select value={form.quarter} onChange={e => setForm(p => ({ ...p, quarter: e.target.value }))} style={inputStyle}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'السنة' : 'Year'}</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} style={inputStyle}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'القسم' : 'Department'}</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={inputStyle}>
                <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{isRTL ? d.name_ar : d.name_en}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الحالة' : 'Status'}</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                {OBJ_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{isRTL ? s.label_ar : s.label_en}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'المالك' : 'Owner Name'}</label>
              <input value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'معرف المالك' : 'Owner ID'}</label>
              <input value={form.owner_id} onChange={e => setForm(p => ({ ...p, owner_id: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Key Results builder */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            marginBottom: 10,
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'النتائج الرئيسية' : 'Key Results'}
            </p>
            <button onClick={addKR} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(74,122,171,0.12)', color: '#4A7AAB',
              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}>
              <Plus size={14} />
              {isRTL ? 'إضافة' : 'Add KR'}
            </button>
          </div>

          {form.keyResults.map((kr, idx) => (
            <div key={kr.id || idx} style={{
              padding: 12, borderRadius: 10, marginBottom: 8,
              background: isDark ? '#0a1929' : '#f8fafc',
              border: '1px solid ' + (isDark ? '#ffffff08' : '#e2e8f0'),
              position: 'relative',
            }}>
              <button onClick={() => removeKR(idx)} style={{
                position: 'absolute', top: 8, right: isRTL ? 'auto' : 8, left: isRTL ? 8 : 'auto',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#EF4444',
              }}>
                <X size={14} />
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Title (EN)</label>
                  <input value={kr.title} onChange={e => updateKRField(idx, 'title', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Title (AR)</label>
                  <input value={kr.titleAr} onChange={e => updateKRField(idx, 'titleAr', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }} dir="rtl" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>{isRTL ? 'الهدف' : 'Target'}</label>
                  <input type="number" value={kr.target} onChange={e => updateKRField(idx, 'target', Number(e.target.value))} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>{isRTL ? 'الوحدة' : 'Unit'}</label>
                  <select value={kr.unit} onChange={e => updateKRField(idx, 'unit', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}>
                    {KR_UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{isRTL ? u.label_ar : u.label_en}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>{isRTL ? 'الحالة' : 'Status'}</label>
                  <select value={kr.status} onChange={e => updateKRField(idx, 'status', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}>
                    {KR_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{isRTL ? s.label_ar : s.label_en}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 10 }}>{isRTL ? 'الموعد' : 'Due Date'}</label>
                  <input type="date" value={kr.dueDate} onChange={e => updateKRField(idx, 'dueDate', e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid ' + (isDark ? '#ffffff10' : '#e2e8f0'),
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid ' + (isDark ? '#ffffff20' : '#e2e8f0'),
            background: 'transparent', color: isDark ? '#94a3b8' : '#64748b',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            disabled={!form.title.trim()}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: !form.title.trim() ? '#94a3b8' : '#4A7AAB',
              color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: form.title.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
          >
            <Save size={14} />
            {editObj ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إنشاء' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function GoalsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [year, setYear] = useState(CURRENT_YEAR);
  const [objectives, setObjectives] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editObj, setEditObj] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Smart filter
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([]);

  // Audit filter
  const { auditFields, applyAuditFilters } = useAuditFilter('okr');

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: OBJ_STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label_ar, labelEn: s.label_en })),
    },
    {
      id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: DEPARTMENTS.map(d => ({ value: d.id, label: d.name_ar, labelEn: d.name_en })),
    },
    {
      id: 'owner_name', label: 'المالك', labelEn: 'Owner', type: 'text',
    },
    {
      id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created', type: 'date',
    },
    ...auditFields,
  ], [auditFields]);

  const loadData = useCallback(() => {
    const data = getObjectives({ quarter, year });
    setObjectives(data);
  }, [quarter, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const summary = useMemo(() => getQuarterSummary(quarter, year), [objectives, quarter, year]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = [...objectives];
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.title.toLowerCase().includes(q) ||
        (o.titleAr || '').toLowerCase().includes(q) ||
        o.owner_name.toLowerCase().includes(q) ||
        o.department.toLowerCase().includes(q)
      );
    }
    // Smart filters
    if (filters.length > 0) {
      result = applySmartFilters(result, filters, SMART_FIELDS);
      result = applyAuditFilters(result, filters);
    }
    return result;
  }, [objectives, search, filters, SMART_FIELDS, applyAuditFilters]);

  // Paginated
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginatedData = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSave = (formData) => {
    if (editObj) {
      const result = updateObjective(editObj.id, formData);
      if (result) {
        logAction({ action: 'update', entity: 'okr', entityId: editObj.id, entityName: formData.title, description: `Updated objective: ${formData.title}`, userName: profile?.full_name_en || 'System' });
      }
    } else {
      const obj = createObjective(formData);
      logAction({ action: 'create', entity: 'okr', entityId: obj.id, entityName: formData.title, description: `Created objective: ${formData.title}`, userName: profile?.full_name_en || 'System' });
    }
    setEditObj(null);
    loadData();
  };

  const handleDelete = (id) => {
    const obj = deleteObjective(id);
    if (obj) {
      logAction({ action: 'delete', entity: 'okr', entityId: id, entityName: obj.title, description: `Deleted objective: ${obj.title}`, userName: profile?.full_name_en || 'System' });
    }
    loadData();
  };

  const handleUpdateKR = (objId, krId, updates) => {
    updateKeyResult(objId, krId, updates);
    loadData();
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      padding: '16px 28px',
      background: isDark ? '#0a1929' : '#f8fafc',
      minHeight: '100vh',
    }}>
      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(74,122,171,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={22} color="#4A7AAB" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'الأهداف والنتائج الرئيسية' : 'Goals & OKRs'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL ? 'إدارة الأهداف والنتائج الرئيسية للمؤسسة' : 'Manage organizational objectives and key results'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditObj(null); setShowModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: '#4A7AAB', color: '#ffffff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          <Plus size={16} />
          {isRTL ? 'هدف جديد' : 'New Objective'}
        </button>
      </div>

      {/* Quarter / Year selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
        flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {QUARTERS.map(q => (
            <button
              key={q}
              onClick={() => { setQuarter(q); setPage(1); }}
              style={{
                padding: '7px 16px', borderRadius: 8, border: '1px solid ' + (quarter === q ? '#4A7AAB' : (isDark ? '#ffffff15' : '#e2e8f0')),
                background: quarter === q ? '#4A7AAB' : (isDark ? '#1a2332' : '#ffffff'),
                color: quarter === q ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={e => { setYear(Number(e.target.value)); setPage(1); }}
          style={{
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid ' + (isDark ? '#ffffff15' : '#e2e8f0'),
            background: isDark ? '#1a2332' : '#ffffff',
            color: isDark ? '#e2e8f0' : '#1e293b',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Target} label={isRTL ? 'إجمالي الأهداف' : 'Total Objectives'} value={summary.total} sub={`${quarter} ${year}`} color="#4A7AAB" />
        <KpiCard icon={BarChart3} label={isRTL ? 'متوسط التقدم' : 'Avg Progress'} value={`${summary.avgProgress}%`} sub={isRTL ? 'جميع الأهداف' : 'All objectives'} color={summary.avgProgress >= 60 ? '#10B981' : '#F59E0B'} />
        <KpiCard icon={CheckCircle} label={isRTL ? 'على المسار' : 'On Track'} value={summary.onTrack} sub={isRTL ? 'هدف' : 'objectives'} color="#10B981" />
        <KpiCard icon={AlertTriangle} label={isRTL ? 'في خطر' : 'At Risk'} value={summary.atRisk} sub={isRTL ? 'هدف' : 'objectives'} color="#F59E0B" />
        <KpiCard icon={TrendingDown} label={isRTL ? 'متأخر' : 'Behind'} value={summary.behind} sub={isRTL ? 'هدف' : 'objectives'} color="#EF4444" />
      </div>

      {/* SmartFilter */}
      <div style={{ marginBottom: 16 }}>
        <SmartFilter
          fields={SMART_FIELDS}
          filters={filters}
          onFiltersChange={setFilters}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={isRTL ? 'بحث في الأهداف...' : 'Search objectives...'}
          resultsCount={filtered.length}
        />
      </div>

      {/* Objectives list */}
      {paginatedData.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center',
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 14, border: '1px solid ' + (isDark ? '#ffffff12' : '#e2e8f0'),
        }}>
          <Target size={40} color={isDark ? '#94a3b8' : '#64748b'} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
            {isRTL ? 'لا توجد أهداف لهذا الربع' : 'No objectives for this quarter'}
          </p>
        </div>
      ) : (
        paginatedData.map(obj => (
          <ObjectiveCard
            key={obj.id}
            obj={obj}
            isRTL={isRTL}
            isDark={isDark}
            lang={lang}
            expanded={!!expanded[obj.id]}
            onToggle={() => toggleExpand(obj.id)}
            onEdit={(o) => { setEditObj(o); setShowModal(true); }}
            onDelete={handleDelete}
            onUpdateKR={handleUpdateKR}
          />
        ))
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={v => { setPageSize(v); setPage(1); }}
          totalItems={filtered.length}
          safePage={safePage}
        />
      )}

      {/* Modal */}
      <ObjectiveModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditObj(null); }}
        onSave={handleSave}
        editObj={editObj}
        isDark={isDark}
        isRTL={isRTL}
        lang={lang}
      />
    </div>
  );
}
