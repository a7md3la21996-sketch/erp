import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Zap, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
import {
  getTriggers, createTrigger, updateTrigger, deleteTrigger, toggleTrigger,
  ENTITY_TYPES, EVENT_TYPES, ENTITY_EVENTS, ACTION_TYPES, CONDITION_OPERATORS,
} from '../../services/triggerService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import SmartFilter, { applySmartFilters } from '../../components/ui/SmartFilter';
import Pagination from '../../components/ui/Pagination';

// ── Empty state ─────────────────────────────────────────────────────────
function EmptyState({ isRTL, isDark, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Zap size={28} color="#4A7AAB" />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
        {isRTL ? 'لا توجد مشغلات تلقائية' : 'No Triggers Yet'}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
        {isRTL ? 'أنشئ مشغلات لأتمتة الإشعارات والإجراءات' : 'Create triggers to automate notifications and actions'}
      </p>
      <button onClick={onAdd} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        <Plus size={15} />
        {isRTL ? 'إضافة مشغل' : 'Add Trigger'}
      </button>
    </div>
  );
}

// ── Trigger Modal ───────────────────────────────────────────────────────
function TriggerModal({ trigger, onClose, onSave, isRTL, isDark }) {
  const isEdit = !!trigger?.id;
  const [form, setForm] = useState({
    name: trigger?.name || '',
    entity: trigger?.entity || 'contact',
    event: trigger?.event || ENTITY_EVENTS['contact'][0],
    conditions: trigger?.conditions || [],
    actions: trigger?.actions || [],
    enabled: trigger?.enabled !== false,
  });

  const events = ENTITY_EVENTS[form.entity] || [];

  const handleEntityChange = (entity) => {
    const evts = ENTITY_EVENTS[entity] || [];
    setForm(f => ({ ...f, entity, event: evts[0] || '' }));
  };

  // ── Conditions ──
  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', operator: 'equals', value: '' }] }));
  const removeCondition = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i, key, val) => setForm(f => ({
    ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
  }));

  // ── Actions ──
  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'notification', config: {} }] }));
  const removeAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i, key, val) => setForm(f => ({
    ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [key]: val } : a),
  }));
  const updateActionConfig = (i, key, val) => setForm(f => ({
    ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, config: { ...a.config, [key]: val } } : a),
  }));

  const canSave = form.name.trim() && form.entity && form.event && form.actions.length > 0;

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    background: isDark ? '#0f2440' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', fontFamily: 'inherit',
  };

  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'auto' };

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 };

  const sectionTitle = (text) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB', marginBottom: 8, marginTop: 16 }}>{text}</div>
  );

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 16, width: '100%', maxWidth: 580,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="#4A7AAB" />
            <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isEdit ? (isRTL ? 'تعديل مشغل' : 'Edit Trigger') : (isRTL ? 'إضافة مشغل جديد' : 'Add New Trigger')}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Name */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isRTL ? 'اسم المشغل' : 'Trigger Name'}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}
              placeholder={isRTL ? 'مثال: إشعار عند إنشاء جهة اتصال' : 'e.g. Notify on contact creation'} />
          </div>

          {/* Entity + Event */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الكيان' : 'Entity'}</label>
              <select value={form.entity} onChange={e => handleEntityChange(e.target.value)} style={selectStyle}>
                {Object.entries(ENTITY_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الحدث' : 'Event'}</label>
              <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} style={selectStyle}>
                {events.map(ev => (
                  <option key={ev} value={ev}>{isRTL ? EVENT_TYPES[ev]?.ar : EVENT_TYPES[ev]?.en}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Enabled toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              {form.enabled
                ? <ToggleRight size={28} color="#4A7AAB" />
                : <ToggleLeft size={28} color={isDark ? '#475569' : '#94a3b8'} />
              }
            </button>
            <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {form.enabled ? (isRTL ? 'مفعّل' : 'Enabled') : (isRTL ? 'معطّل' : 'Disabled')}
            </span>
          </div>

          {/* Conditions */}
          {sectionTitle(isRTL ? 'الشروط (اختياري)' : 'Conditions (optional)')}
          {form.conditions.map((cond, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
              padding: '8px 10px', borderRadius: 8,
              background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
              border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            }}>
              <input value={cond.field} onChange={e => updateCondition(i, 'field', e.target.value)}
                placeholder={isRTL ? 'الحقل' : 'Field'} style={{ ...inputStyle, flex: 1 }} />
              <select value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                {Object.entries(CONDITION_OPERATORS).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </select>
              {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                <input value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)}
                  placeholder={isRTL ? 'القيمة' : 'Value'} style={{ ...inputStyle, flex: 1 }} />
              )}
              <button onClick={() => removeCondition(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button onClick={addCondition} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
            color: '#4A7AAB', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          }}>
            <Plus size={13} /> {isRTL ? 'إضافة شرط' : 'Add Condition'}
          </button>

          {/* Actions */}
          {sectionTitle(isRTL ? 'الإجراءات *' : 'Actions *')}
          {form.actions.map((act, i) => (
            <div key={i} style={{
              marginBottom: 10, padding: '10px 12px', borderRadius: 8,
              background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
              border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select value={act.type} onChange={e => updateAction(i, 'type', e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                  {Object.entries(ACTION_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                  ))}
                </select>
                <button onClick={() => removeAction(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Config fields per type */}
              {act.type === 'notification' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'العنوان (عربي)' : 'Title (AR)'}</label>
                    <input value={act.config?.title_ar || ''} onChange={e => updateActionConfig(i, 'title_ar', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'العنوان (إنجليزي)' : 'Title (EN)'}</label>
                    <input value={act.config?.title_en || ''} onChange={e => updateActionConfig(i, 'title_en', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'المحتوى (عربي)' : 'Body (AR)'}</label>
                    <input value={act.config?.body_ar || ''} onChange={e => updateActionConfig(i, 'body_ar', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'المحتوى (إنجليزي)' : 'Body (EN)'}</label>
                    <input value={act.config?.body_en || ''} onChange={e => updateActionConfig(i, 'body_en', e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>{isRTL ? 'إرسال لـ (user ID أو all)' : 'Send to (user ID or all)'}</label>
                    <input value={act.config?.for_user_id || ''} onChange={e => updateActionConfig(i, 'for_user_id', e.target.value)}
                      placeholder="all" style={inputStyle} />
                  </div>
                </div>
              )}

              {act.type === 'assign' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'تعيين لـ (ID)' : 'Assign to (ID)'}</label>
                    <input value={act.config?.assign_to || ''} onChange={e => updateActionConfig(i, 'assign_to', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isRTL ? 'الاسم' : 'Name'}</label>
                    <input value={act.config?.assign_to_name || ''} onChange={e => updateActionConfig(i, 'assign_to_name', e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {act.type === 'status_change' && (
                <div>
                  <label style={labelStyle}>{isRTL ? 'الحالة الجديدة' : 'New Status'}</label>
                  <input value={act.config?.new_status || ''} onChange={e => updateActionConfig(i, 'new_status', e.target.value)} style={inputStyle} />
                </div>
              )}

              {act.type === 'tag' && (
                <div>
                  <label style={labelStyle}>{isRTL ? 'الوسم' : 'Tag'}</label>
                  <input value={act.config?.tag || ''} onChange={e => updateActionConfig(i, 'tag', e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
          ))}
          <button onClick={addAction} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
            color: '#4A7AAB', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          }}>
            <Plus size={13} /> {isRTL ? 'إضافة إجراء' : 'Add Action'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'none', cursor: 'pointer',
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => canSave && onSave(form)} disabled={!canSave} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: canSave ? '#4A7AAB' : (isDark ? '#1e3a5f' : '#e2e8f0'),
            color: canSave ? '#fff' : (isDark ? '#475569' : '#94a3b8'),
            border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
          }}>
            {isEdit ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إنشاء المشغل' : 'Create Trigger')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ────────────────────────────────────────────────
function DeleteModal({ trigger, onClose, onConfirm, isRTL, isDark }) {
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16, padding: '24px 28px',
        maxWidth: 400, width: '100%', textAlign: 'center',
        border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trash2 size={22} color="#ef4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {isRTL ? 'حذف المشغل؟' : 'Delete Trigger?'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
          {isRTL ? `سيتم حذف "${trigger?.name}" نهائياً` : `"${trigger?.name}" will be permanently deleted`}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'none', cursor: 'pointer',
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            color: isDark ? '#94a3b8' : '#64748b',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => onConfirm(trigger)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            {isRTL ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function TriggersPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [triggers, setTriggers] = useState(() => getTriggers());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { auditFields, applyAuditFilters } = useAuditFilter('trigger');

  const SMART_FIELDS = useMemo(() => [
    { id: 'entity', label: 'الكيان', labelEn: 'Entity', type: 'select', options: Object.entries(ENTITY_TYPES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'event', label: 'الحدث', labelEn: 'Event', type: 'select', options: Object.entries(EVENT_TYPES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'enabled', label: 'الحالة', labelEn: 'Status', type: 'select', options: [
      { value: 'true', label: 'مفعّل', labelEn: 'Enabled' },
      { value: 'false', label: 'معطّل', labelEn: 'Disabled' },
    ]},
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  // Filter + search
  const filtered = useMemo(() => {
    let data = triggers.map(t => ({ ...t, enabled: String(t.enabled) }));
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t => t.name.toLowerCase().includes(q) || t.entity.toLowerCase().includes(q));
    }
    data = applySmartFilters(data, smartFilters, SMART_FIELDS);
    data = applyAuditFilters(data, smartFilters);
    return data;
  }, [triggers, search, smartFilters, SMART_FIELDS, applyAuditFilters]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const reload = () => setTriggers(getTriggers());

  const handleSave = (form) => {
    const userName = profile?.full_name_ar || profile?.full_name_en || 'System';
    if (editTarget) {
      updateTrigger(editTarget.id, { ...form });
      logAction({ action: 'update', entity: 'trigger', entityId: editTarget.id, entityName: form.name, description: `Updated trigger: ${form.name}`, userName });
    } else {
      const created = createTrigger({ ...form, created_by: userName });
      logAction({ action: 'create', entity: 'trigger', entityId: created.id, entityName: form.name, description: `Created trigger: ${form.name}`, userName });
    }
    reload();
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = (trigger) => {
    const userName = profile?.full_name_ar || profile?.full_name_en || 'System';
    deleteTrigger(trigger.id);
    logAction({ action: 'delete', entity: 'trigger', entityId: trigger.id, entityName: trigger.name, description: `Deleted trigger: ${trigger.name}`, userName });
    reload();
    setDeleteTarget(null);
  };

  const handleToggle = (trigger) => {
    const userName = profile?.full_name_ar || profile?.full_name_en || 'System';
    toggleTrigger(trigger.id);
    logAction({ action: 'update', entity: 'trigger', entityId: trigger.id, entityName: trigger.name, description: `Toggled trigger: ${trigger.name}`, userName });
    reload();
  };

  const thStyle = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: '#6B8DB5', padding: '12px 16px', textAlign: isRTL ? 'right' : 'left',
    background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(248,250,252,0.8)',
    borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: '12px 16px', fontSize: 13, textAlign: isRTL ? 'right' : 'left',
    borderBottom: `1px solid ${isDark ? 'rgba(30,58,95,0.5)' : 'rgba(226,232,240,0.5)'}`,
    color: isDark ? '#e2e8f0' : '#1e293b',
    verticalAlign: 'middle',
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      fontFamily: "'Cairo','Tajawal',sans-serif",
      color: isDark ? '#e2e8f0' : '#1e293b',
      padding: '24px 28px', minHeight: '100vh',
      background: isDark ? '#0a1929' : '#f8fafc',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)',
          }}>
            <Zap size={20} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'المشغلات التلقائية' : 'Automated Triggers'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL ? 'إدارة الإشعارات والإجراءات التلقائية' : 'Manage automated notifications and actions'}
            </p>
          </div>
        </div>
        <button onClick={() => { setEditTarget(null); setShowModal(true); }} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={15} />
          {isRTL ? 'إضافة مشغل' : 'Add Trigger'}
        </button>
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isRTL ? 'بحث في المشغلات...' : 'Search triggers...'}
        resultsCount={filtered.length}
      />

      {/* Table or Empty */}
      {triggers.length === 0 ? (
        <EmptyState isRTL={isRTL} isDark={isDark} onAdd={() => { setEditTarget(null); setShowModal(true); }} />
      ) : (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
          background: isDark ? '#132337' : '#ffffff',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>{isRTL ? 'الاسم' : 'Name'}</th>
                  <th style={thStyle}>{isRTL ? 'الكيان' : 'Entity'}</th>
                  <th style={thStyle}>{isRTL ? 'الحدث' : 'Event'}</th>
                  <th style={thStyle}>{isRTL ? 'الشروط' : 'Conditions'}</th>
                  <th style={thStyle}>{isRTL ? 'الإجراءات' : 'Actions'}</th>
                  <th style={thStyle}>{isRTL ? 'الحالة' : 'Status'}</th>
                  <th style={thStyle}>{isRTL ? 'تاريخ الإنشاء' : 'Created'}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(trigger => {
                  const isEnabled = trigger.enabled === true || trigger.enabled === 'true';
                  return (
                    <tr key={trigger.id} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.05)' : 'rgba(74,122,171,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{trigger.name}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
                          color: '#4A7AAB',
                        }}>
                          {isRTL ? ENTITY_TYPES[trigger.entity]?.ar : ENTITY_TYPES[trigger.entity]?.en}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                          {isRTL ? EVENT_TYPES[trigger.event]?.ar : EVENT_TYPES[trigger.event]?.en}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)',
                          color: '#4A7AAB',
                        }}>
                          {(trigger.conditions || []).length}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)',
                          color: '#4A7AAB',
                        }}>
                          {(trigger.actions || []).length}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => handleToggle(trigger)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {isEnabled
                            ? <ToggleRight size={22} color="#10b981" />
                            : <ToggleLeft size={22} color={isDark ? '#475569' : '#94a3b8'} />
                          }
                          <span style={{ fontSize: 11, fontWeight: 600, color: isEnabled ? '#10b981' : (isDark ? '#475569' : '#94a3b8') }}>
                            {isEnabled ? (isRTL ? 'مفعّل' : 'On') : (isRTL ? 'معطّل' : 'Off')}
                          </span>
                        </button>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                        {new Date(trigger.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => { setEditTarget(trigger); setShowModal(true); }} title={isRTL ? 'تعديل' : 'Edit'} style={{
                            width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)',
                            color: '#4A7AAB',
                          }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(trigger)} title={isRTL ? 'حذف' : 'Delete'} style={{
                            width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
                            color: '#ef4444',
                          }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <TriggerModal
          trigger={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave}
          isRTL={isRTL}
          isDark={isDark}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          trigger={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isRTL={isRTL}
          isDark={isDark}
        />
      )}
    </div>
  );
}
