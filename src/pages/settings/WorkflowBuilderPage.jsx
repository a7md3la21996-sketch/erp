import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  GitBranch, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X,
  Zap, Filter, Play, ChevronDown, ChevronRight, ArrowDown,
  Bell, UserPlus, RefreshCw, Edit3, ClipboardList, MessageSquare,
  CheckCircle, XCircle, AlertTriangle, Save, ArrowLeft,
} from 'lucide-react';
import {
  getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, toggleWorkflow, testWorkflow,
  TRIGGER_ENTITIES, TRIGGER_EVENTS, ENTITY_EVENTS_MAP, CONDITION_OPERATORS,
  ACTION_TYPES, ENTITY_FIELDS,
} from '../../services/workflowService';
import { logAction } from '../../services/auditService';

const ACTION_ICONS = { Bell, UserPlus, RefreshCw, Edit3, ClipboardList, MessageSquare };

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ isRTL, isDark, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <GitBranch size={28} color="#4A7AAB" />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
        {isRTL ? 'لا توجد سير عمل' : 'No Workflows Yet'}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
        {isRTL ? 'أنشئ سير عمل لأتمتة العمليات في النظام' : 'Create workflows to automate processes in the system'}
      </p>
      <button onClick={onAdd} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        <Plus size={15} />
        {isRTL ? 'إنشاء سير عمل' : 'New Workflow'}
      </button>
    </div>
  );
}

// ── Arrow Connector ─────────────────────────────────────────────────────
function ArrowConnector({ isDark, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <div style={{ width: 2, height: 20, background: isDark ? '#334155' : '#cbd5e1' }} />
      {label && (
        <div style={{
          fontSize: 10, fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8',
          background: isDark ? '#1a2332' : '#f1f5f9', padding: '2px 8px', borderRadius: 4,
          margin: '2px 0',
        }}>{label}</div>
      )}
      <div style={{
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: `6px solid ${isDark ? '#334155' : '#cbd5e1'}`,
      }} />
    </div>
  );
}

// ── Flow Card ───────────────────────────────────────────────────────────
function FlowCard({ color, isDark, icon: Icon, title, subtitle, children, onRemove, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div style={{
      background: isDark ? '#132337' : '#ffffff',
      border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
      borderRadius: 12,
      borderLeft: `4px solid ${color}`,
      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon && <Icon size={16} color={color} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 1 }}>{subtitle}</div>}
        </div>
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: isDark ? '#64748b' : '#94a3b8',
          }}>
            <X size={14} />
          </button>
        )}
        {expanded ? <ChevronDown size={14} color={isDark ? '#64748b' : '#94a3b8'} /> : <ChevronRight size={14} color={isDark ? '#64748b' : '#94a3b8'} />}
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${isDark ? '#1e3a5f22' : '#f1f5f9'}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Workflow Editor ─────────────────────────────────────────────────────
function WorkflowEditor({ workflow, onSave, onCancel, isRTL, isDark }) {
  const isEdit = !!workflow?.id;
  const [form, setForm] = useState({
    name: workflow?.name || '',
    nameAr: workflow?.nameAr || '',
    description: workflow?.description || '',
    trigger: workflow?.trigger || { entity: 'contact', event: 'created' },
    conditions: workflow?.conditions || [],
    actions: workflow?.actions || [],
    enabled: workflow?.enabled !== false,
  });
  const [testResults, setTestResults] = useState(null);
  const [showTest, setShowTest] = useState(false);

  const availableEvents = ENTITY_EVENTS_MAP[form.trigger.entity] || [];
  const availableFields = ENTITY_FIELDS[form.trigger.entity] || [];

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    background: isDark ? '#0f2440' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'auto' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, marginTop: 10 };

  // Trigger
  const handleEntityChange = (entity) => {
    const evts = ENTITY_EVENTS_MAP[entity] || [];
    setForm(f => ({ ...f, trigger: { entity, event: evts[0] || 'created' }, conditions: f.conditions.map(c => ({ ...c, field: '' })) }));
  };

  // Conditions
  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: availableFields[0] || '', operator: 'equals', value: '', connector: 'and' }] }));
  const removeCondition = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i, key, val) => setForm(f => ({
    ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
  }));

  // Actions
  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'send_notification', config: {} }] }));
  const removeAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i, key, val) => setForm(f => ({
    ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, [key]: val } : a),
  }));
  const updateActionConfig = (i, key, val) => setForm(f => ({
    ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, config: { ...a.config, [key]: val } } : a),
  }));

  const canSave = form.name.trim() && form.trigger.entity && form.trigger.event && form.actions.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(form);
  };

  const handleTest = () => {
    const results = testWorkflow(form);
    setTestResults(results);
    setShowTest(true);
  };

  const entityInfo = TRIGGER_ENTITIES[form.trigger.entity];
  const eventInfo = TRIGGER_EVENTS[form.trigger.event];

  // Action config fields by type
  const renderActionConfig = (action, index) => {
    switch (action.type) {
      case 'send_notification':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'العنوان' : 'Title'}</label>
            <input style={inputStyle} value={action.config?.title || ''} onChange={(e) => updateActionConfig(index, 'title', e.target.value)} placeholder={isRTL ? 'عنوان الإشعار' : 'Notification title'} />
            <label style={labelStyle}>{isRTL ? 'الرسالة' : 'Message'}</label>
            <input style={inputStyle} value={action.config?.message || ''} onChange={(e) => updateActionConfig(index, 'message', e.target.value)} placeholder={isRTL ? 'نص الرسالة' : 'Message text'} />
          </>
        );
      case 'assign_to':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'تعيين إلى' : 'Assign To'}</label>
            <input style={inputStyle} value={action.config?.assign_to || ''} onChange={(e) => updateActionConfig(index, 'assign_to', e.target.value)} placeholder={isRTL ? 'اسم المستخدم أو الدور' : 'User name or role'} />
            <label style={labelStyle}>{isRTL ? 'السبب' : 'Reason'}</label>
            <input style={inputStyle} value={action.config?.reason || ''} onChange={(e) => updateActionConfig(index, 'reason', e.target.value)} placeholder={isRTL ? 'سبب التعيين' : 'Assignment reason'} />
          </>
        );
      case 'change_status':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'الحالة الجديدة' : 'New Status'}</label>
            <input style={inputStyle} value={action.config?.new_status || ''} onChange={(e) => updateActionConfig(index, 'new_status', e.target.value)} placeholder={isRTL ? 'أدخل الحالة' : 'Enter status'} />
          </>
        );
      case 'change_field':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'الحقل' : 'Field'}</label>
            <select style={selectStyle} value={action.config?.field || ''} onChange={(e) => updateActionConfig(index, 'field', e.target.value)}>
              <option value="">{isRTL ? 'اختر حقل' : 'Select field'}</option>
              {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <label style={labelStyle}>{isRTL ? 'القيمة الجديدة' : 'New Value'}</label>
            <input style={inputStyle} value={action.config?.new_value || ''} onChange={(e) => updateActionConfig(index, 'new_value', e.target.value)} placeholder={isRTL ? 'القيمة' : 'Value'} />
          </>
        );
      case 'create_task':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'عنوان المهمة' : 'Task Title'}</label>
            <input style={inputStyle} value={action.config?.title || ''} onChange={(e) => updateActionConfig(index, 'title', e.target.value)} placeholder={isRTL ? 'عنوان المهمة' : 'Task title'} />
            <label style={labelStyle}>{isRTL ? 'الأولوية' : 'Priority'}</label>
            <select style={selectStyle} value={action.config?.priority || 'medium'} onChange={(e) => updateActionConfig(index, 'priority', e.target.value)}>
              <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
              <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
              <option value="high">{isRTL ? 'عالية' : 'High'}</option>
              <option value="urgent">{isRTL ? 'عاجلة' : 'Urgent'}</option>
            </select>
          </>
        );
      case 'send_sms':
        return (
          <>
            <label style={labelStyle}>{isRTL ? 'قالب الرسالة' : 'SMS Template'}</label>
            <input style={inputStyle} value={action.config?.template || ''} onChange={(e) => updateActionConfig(index, 'template', e.target.value)} placeholder={isRTL ? 'نص الرسالة القصيرة' : 'SMS message template'} />
            <label style={labelStyle}>{isRTL ? 'رقم المستلم (حقل)' : 'Recipient Field'}</label>
            <select style={selectStyle} value={action.config?.phone_field || 'phone'} onChange={(e) => updateActionConfig(index, 'phone_field', e.target.value)}>
              {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`, background: 'none',
          color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', fontSize: 13,
        }}>
          <ArrowLeft size={14} />
          {isRTL ? 'رجوع' : 'Back'}
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', flex: 1 }}>
          {isEdit ? (isRTL ? 'تعديل سير العمل' : 'Edit Workflow') : (isRTL ? 'سير عمل جديد' : 'New Workflow')}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleTest} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8,
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`, cursor: 'pointer',
            background: isDark ? '#1a2332' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 13, fontWeight: 600,
          }}>
            <Play size={14} />
            {isRTL ? 'اختبار' : 'Test'}
          </button>
          <button onClick={handleSave} disabled={!canSave} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
            background: canSave ? '#4A7AAB' : (isDark ? '#1e3a5f' : '#e2e8f0'),
            color: canSave ? '#fff' : (isDark ? '#64748b' : '#94a3b8'), fontSize: 13, fontWeight: 600,
            opacity: canSave ? 1 : 0.6,
          }}>
            <Save size={14} />
            {isRTL ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div style={{
        background: isDark ? '#132337' : '#ffffff',
        border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`, borderRadius: 12,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isRTL ? 'اسم سير العمل' : 'Workflow name'} />
          </div>
          <div>
            <label style={labelStyle}>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
            <input style={inputStyle} value={form.nameAr} onChange={(e) => setForm(f => ({ ...f, nameAr: e.target.value }))} placeholder="اسم سير العمل" dir="rtl" />
          </div>
        </div>
        <label style={labelStyle}>{isRTL ? 'الوصف' : 'Description'}</label>
        <input style={inputStyle} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder={isRTL ? 'وصف مختصر' : 'Brief description'} />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: form.enabled ? '#10B981' : (isDark ? '#64748b' : '#94a3b8'), fontSize: 13, fontWeight: 600, padding: 0,
          }}>
            {form.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {form.enabled ? (isRTL ? 'مفعّل' : 'Enabled') : (isRTL ? 'معطّل' : 'Disabled')}
          </button>
        </div>
      </div>

      {/* Visual Flow Builder */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

        {/* Step 1: Trigger */}
        <div style={{ width: '100%', maxWidth: 540 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isRTL ? 'الخطوة 1 — المشغّل' : 'Step 1 — Trigger'}
          </div>
          <FlowCard
            color="#3B82F6"
            isDark={isDark}
            icon={Zap}
            title={isRTL ? 'عندما' : 'When'}
            subtitle={entityInfo ? `${isRTL ? entityInfo.ar : entityInfo.en} → ${isRTL ? (eventInfo?.ar || '') : (eventInfo?.en || '')}` : ''}
            defaultExpanded={true}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 10 }}>
              <div>
                <label style={labelStyle}>{isRTL ? 'الكيان' : 'Entity'}</label>
                <select style={selectStyle} value={form.trigger.entity} onChange={(e) => handleEntityChange(e.target.value)}>
                  {Object.entries(TRIGGER_ENTITIES).map(([k, v]) => (
                    <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{isRTL ? 'الحدث' : 'Event'}</label>
                <select style={selectStyle} value={form.trigger.event} onChange={(e) => setForm(f => ({ ...f, trigger: { ...f.trigger, event: e.target.value } }))}>
                  {availableEvents.map(ev => (
                    <option key={ev} value={ev}>{isRTL ? (TRIGGER_EVENTS[ev]?.ar || ev) : (TRIGGER_EVENTS[ev]?.en || ev)}</option>
                  ))}
                </select>
              </div>
            </div>
          </FlowCard>
        </div>

        <ArrowConnector isDark={isDark} />

        {/* Step 2: Conditions */}
        <div style={{ width: '100%', maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isRTL ? 'الخطوة 2 — الشروط' : 'Step 2 — Conditions'}
            </div>
            <button onClick={addCondition} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
              border: `1px dashed ${isDark ? '#F59E0B44' : '#F59E0B66'}`, background: 'none',
              color: '#F59E0B', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>
              <Plus size={12} />
              {isRTL ? 'إضافة شرط' : 'Add Condition'}
            </button>
          </div>

          {form.conditions.length === 0 ? (
            <div style={{
              background: isDark ? '#132337' : '#ffffff',
              border: `1px dashed ${isDark ? '#F59E0B33' : '#F59E0B44'}`, borderRadius: 12,
              padding: '16px 20px', textAlign: 'center',
              borderLeft: '4px solid #F59E0B',
            }}>
              <Filter size={16} color="#F59E0B" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'بدون شروط — سيتم التنفيذ دائماً' : 'No conditions — will always execute'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {form.conditions.map((cond, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                      <button onClick={() => updateCondition(i, 'connector', cond.connector === 'and' ? 'or' : 'and')} style={{
                        padding: '2px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: cond.connector === 'and' ? '#3B82F620' : '#F59E0B20',
                        color: cond.connector === 'and' ? '#3B82F6' : '#F59E0B',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      }}>
                        {cond.connector === 'and' ? (isRTL ? 'و' : 'AND') : (isRTL ? 'أو' : 'OR')}
                      </button>
                    </div>
                  )}
                  <FlowCard
                    color="#F59E0B"
                    isDark={isDark}
                    icon={Filter}
                    title={`${isRTL ? 'شرط' : 'Condition'} ${i + 1}`}
                    subtitle={cond.field ? `${cond.field} ${isRTL ? (CONDITION_OPERATORS[cond.operator]?.ar || '') : (CONDITION_OPERATORS[cond.operator]?.en || '')} ${cond.value || ''}` : ''}
                    onRemove={() => removeCondition(i)}
                    defaultExpanded={!cond.field}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 10 }}>
                      <div>
                        <label style={labelStyle}>{isRTL ? 'الحقل' : 'Field'}</label>
                        <select style={selectStyle} value={cond.field} onChange={(e) => updateCondition(i, 'field', e.target.value)}>
                          <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                          {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>{isRTL ? 'العامل' : 'Operator'}</label>
                        <select style={selectStyle} value={cond.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)}>
                          {Object.entries(CONDITION_OPERATORS).map(([k, v]) => (
                            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>{isRTL ? 'القيمة' : 'Value'}</label>
                        <input style={inputStyle} value={cond.value} onChange={(e) => updateCondition(i, 'value', e.target.value)}
                          disabled={cond.operator === 'is_empty' || cond.operator === 'is_not_empty'}
                          placeholder={cond.operator === 'is_empty' || cond.operator === 'is_not_empty' ? '—' : (isRTL ? 'القيمة' : 'Value')}
                        />
                      </div>
                    </div>
                  </FlowCard>
                </div>
              ))}
            </div>
          )}
        </div>

        <ArrowConnector isDark={isDark} />

        {/* Step 3: Actions */}
        <div style={{ width: '100%', maxWidth: 540 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isRTL ? 'الخطوة 3 — الإجراءات' : 'Step 3 — Actions'}
            </div>
            <button onClick={addAction} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
              border: `1px dashed ${isDark ? '#10B98144' : '#10B98166'}`, background: 'none',
              color: '#10B981', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>
              <Plus size={12} />
              {isRTL ? 'إضافة إجراء' : 'Add Action'}
            </button>
          </div>

          {form.actions.length === 0 ? (
            <div style={{
              background: isDark ? '#132337' : '#ffffff',
              border: `1px dashed ${isDark ? '#10B98133' : '#10B98144'}`, borderRadius: 12,
              padding: '16px 20px', textAlign: 'center',
              borderLeft: '4px solid #10B981',
            }}>
              <Play size={16} color="#10B981" style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'أضف إجراء واحد على الأقل' : 'Add at least one action'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.actions.map((action, i) => {
                const actionInfo = ACTION_TYPES[action.type];
                const IconComp = ACTION_ICONS[actionInfo?.icon] || Bell;
                return (
                  <FlowCard
                    key={i}
                    color={actionInfo?.color || '#10B981'}
                    isDark={isDark}
                    icon={IconComp}
                    title={`${isRTL ? 'إجراء' : 'Action'} ${i + 1}`}
                    subtitle={isRTL ? (actionInfo?.ar || action.type) : (actionInfo?.en || action.type)}
                    onRemove={() => removeAction(i)}
                    defaultExpanded={true}
                  >
                    <div style={{ paddingTop: 10 }}>
                      <label style={labelStyle}>{isRTL ? 'النوع' : 'Type'}</label>
                      <select style={selectStyle} value={action.type} onChange={(e) => updateAction(i, 'type', e.target.value)}>
                        {Object.entries(ACTION_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                        ))}
                      </select>
                      {renderActionConfig(action, i)}
                    </div>
                  </FlowCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Test Results Modal */}
      {showTest && testResults && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowTest(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: isDark ? '#0a1929' : '#ffffff',
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '80vh',
            overflow: 'auto', padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {isRTL ? 'نتائج الاختبار' : 'Test Results'}
              </h3>
              <button onClick={() => setShowTest(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#64748b' : '#94a3b8' }}>
                <X size={18} />
              </button>
            </div>

            {/* Trigger */}
            <div style={{
              background: isDark ? '#132337' : '#f0f9ff', borderRadius: 10, padding: 12, marginBottom: 12,
              borderLeft: '3px solid #3B82F6',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Zap size={14} color="#3B82F6" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>{isRTL ? 'المشغّل' : 'Trigger'}</span>
                <CheckCircle size={14} color="#10B981" />
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {testResults.trigger.entity} / {testResults.trigger.event}
              </div>
            </div>

            {/* Sample Data */}
            <div style={{
              background: isDark ? '#132337' : '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12,
              border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
                {isRTL ? 'بيانات الاختبار' : 'Sample Data'}
              </div>
              <div style={{ fontSize: 11, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(testResults.sampleData, null, 2)}
              </div>
            </div>

            {/* Condition Results */}
            {testResults.conditionResults.length > 0 && (
              <div style={{
                background: isDark ? '#132337' : (testResults.conditionsPass ? '#f0fdf4' : '#fef2f2'),
                borderRadius: 10, padding: 12, marginBottom: 12,
                borderLeft: `3px solid ${testResults.conditionsPass ? '#10B981' : '#EF4444'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Filter size={14} color="#F59E0B" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{isRTL ? 'الشروط' : 'Conditions'}</span>
                  {testResults.conditionsPass
                    ? <CheckCircle size={14} color="#10B981" />
                    : <XCircle size={14} color="#EF4444" />
                  }
                </div>
                {testResults.conditionResults.map((cr, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}>
                    {cr.passed ? <CheckCircle size={12} color="#10B981" /> : <XCircle size={12} color="#EF4444" />}
                    <span style={{ fontFamily: 'monospace' }}>{cr.field}</span>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>{cr.operator}</span>
                    <span style={{ fontWeight: 600 }}>{cr.value || '(empty)'}</span>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>= {String(cr.actualValue)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{
              background: isDark ? '#132337' : '#f0fdf4', borderRadius: 10, padding: 12,
              borderLeft: '3px solid #10B981',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Play size={14} color="#10B981" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{isRTL ? 'الإجراءات' : 'Actions'}</span>
              </div>
              {testResults.actionsWouldExecute.length > 0 ? (
                testResults.actionsWouldExecute.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                  }}>
                    <CheckCircle size={12} color="#10B981" />
                    <span style={{ fontWeight: 600 }}>{a.label}</span>
                    {a.config?.title && <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>— {a.config.title}</span>}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} color="#F59E0B" />
                  {isRTL ? 'لن يتم تنفيذ أي إجراءات (الشروط لم تتحقق)' : 'No actions would execute (conditions not met)'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────
export default function WorkflowBuilderPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [workflows, setWorkflows] = useState(() => getWorkflows());
  const [editing, setEditing] = useState(null); // null = list view, {} = new, {id,...} = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const refresh = () => setWorkflows(getWorkflows());

  const handleToggle = (id) => {
    toggleWorkflow(id);
    refresh();
  };

  const handleDelete = (id) => {
    deleteWorkflow(id);
    logAction({ action: 'delete', entity: 'workflow', entityId: id, description: 'Deleted workflow' });
    refresh();
    setDeleteConfirm(null);
  };

  const handleSave = (form) => {
    if (editing?.id) {
      updateWorkflow(editing.id, form);
      logAction({ action: 'update', entity: 'workflow', entityId: editing.id, entityName: form.name, description: 'Updated workflow: ' + form.name });
    } else {
      const created = createWorkflow(form);
      logAction({ action: 'create', entity: 'workflow', entityId: created.id, entityName: form.name, description: 'Created workflow: ' + form.name });
    }
    refresh();
    setEditing(null);
  };

  // ── Editor view ──
  if (editing !== null) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <WorkflowEditor
          workflow={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          isRTL={isRTL}
          isDark={isDark}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{ padding: '24px 28px', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={18} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'سير العمل' : 'Workflows'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL ? 'أتمتة العمليات بصريًا' : 'Visually automate processes'}
            </p>
          </div>
        </div>
        <button onClick={() => setEditing({})} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={15} />
          {isRTL ? 'سير عمل جديد' : 'New Workflow'}
        </button>
      </div>

      {/* Empty state */}
      {workflows.length === 0 && <EmptyState isRTL={isRTL} isDark={isDark} onAdd={() => setEditing({})} />}

      {/* Workflow Table */}
      {workflows.length > 0 && (
        <div style={{
          background: isDark ? '#132337' : '#ffffff',
          border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? '#0f1d2e' : '#f8fafc' }}>
                {[
                  isRTL ? 'الاسم' : 'Name',
                  isRTL ? 'المشغّل' : 'Trigger',
                  isRTL ? 'الشروط' : 'Conditions',
                  isRTL ? 'الإجراءات' : 'Actions',
                  isRTL ? 'الحالة' : 'Status',
                  isRTL ? 'إجراءات' : 'Actions',
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', fontSize: 11, fontWeight: 700,
                    color: isDark ? '#64748b' : '#94a3b8', textAlign: isRTL ? 'right' : 'left',
                    borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflows.map((wf) => {
                const entityInfo = TRIGGER_ENTITIES[wf.trigger?.entity];
                const eventInfo = TRIGGER_EVENTS[wf.trigger?.event];
                return (
                  <tr key={wf.id} style={{
                    borderBottom: `1px solid ${isDark ? '#1e3a5f22' : '#f1f5f9'}`,
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? '#1a2332' : '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Name */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {isRTL ? (wf.nameAr || wf.name) : wf.name}
                      </div>
                      {wf.description && (
                        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wf.description}
                        </div>
                      )}
                    </td>

                    {/* Trigger badge */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: (entityInfo?.color || '#4A7AAB') + '18',
                          color: entityInfo?.color || '#4A7AAB',
                        }}>
                          {isRTL ? (entityInfo?.ar || wf.trigger?.entity) : (entityInfo?.en || wf.trigger?.entity)}
                        </span>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: isDark ? '#ffffff0a' : '#f1f5f9',
                          color: isDark ? '#94a3b8' : '#64748b',
                        }}>
                          {isRTL ? (eventInfo?.ar || wf.trigger?.event) : (eventInfo?.en || wf.trigger?.event)}
                        </span>
                      </div>
                    </td>

                    {/* Conditions count */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                        color: isDark ? '#94a3b8' : '#64748b',
                      }}>
                        <Filter size={12} />
                        {wf.conditions?.length || 0}
                      </span>
                    </td>

                    {/* Actions count */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                        color: isDark ? '#94a3b8' : '#64748b',
                      }}>
                        <Play size={12} />
                        {wf.actions?.length || 0}
                      </span>
                    </td>

                    {/* Enabled toggle */}
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => handleToggle(wf.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: wf.enabled ? '#10B981' : (isDark ? '#64748b' : '#94a3b8'),
                        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                      }}>
                        {wf.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {wf.enabled ? (isRTL ? 'مفعّل' : 'On') : (isRTL ? 'معطّل' : 'Off')}
                      </button>
                    </td>

                    {/* Edit / Delete */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditing(wf)} style={{
                          width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isDark ? '#1e3a5f22' : '#f1f5f9',
                          color: isDark ? '#94a3b8' : '#64748b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteConfirm(wf.id)} style={{
                          width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isDark ? '#1e3a5f22' : '#f1f5f9',
                          color: '#EF4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setDeleteConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: isDark ? '#0a1929' : '#ffffff',
            border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            borderRadius: 16, padding: 24, width: 360,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#EF4444" />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {isRTL ? 'حذف سير العمل' : 'Delete Workflow'}
              </h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL ? 'هل أنت متأكد من حذف سير العمل هذا؟ لا يمكن التراجع.' : 'Are you sure you want to delete this workflow? This cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`, background: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
              }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: 'none', background: '#EF4444', color: '#fff',
              }}>
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
