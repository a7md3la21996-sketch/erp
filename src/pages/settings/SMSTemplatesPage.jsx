import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  MessageSquare, Plus, Pencil, Trash2, X, Eye, Send, Copy, Search,
  FileText, Clock, TrendingUp, Users, Check, ChevronDown,
} from 'lucide-react';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  renderBody, sendSMS, getSMSLog, bulkSend, getTemplateById,
  CATEGORIES, AVAILABLE_VARIABLES, SAMPLE_DATA,
} from '../../services/smsTemplateService';
import { logAction } from '../../services/auditService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import SmartFilter, { applySmartFilters } from '../../components/ui/SmartFilter';
import Pagination from '../../components/ui/Pagination';

// ── Category badge color map ──────────────────────────────────────────
const CAT_COLORS = {
  welcome: '#10B981', followup: '#4A7AAB', reminder: '#F59E0B',
  promotion: '#EC4899', confirmation: '#8B5CF6', custom: '#6B8DB5',
};

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, isDark }) {
  return (
    <div style={{
      flex: '1 1 180px', minWidth: 160, padding: '16px 18px', borderRadius: 14,
      background: isDark ? '#1a2332' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: (color || '#4A7AAB') + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={color || '#4A7AAB'} />
        </div>
        <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>{value}</div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────
function EmptyState({ isRTL, isDark, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <MessageSquare size={28} color="#4A7AAB" />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
        {isRTL ? 'لا توجد قوالب رسائل' : 'No SMS Templates Yet'}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
        {isRTL ? 'أنشئ قوالب رسائل SMS لإرسالها لعملائك' : 'Create SMS templates to send to your clients'}
      </p>
      <button onClick={onAdd} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
      }}>
        <Plus size={15} />
        {isRTL ? 'إضافة قالب' : 'Add Template'}
      </button>
    </div>
  );
}

// ── Template Modal (Create / Edit) ────────────────────────────────────
function TemplateModal({ template, onClose, onSave, isRTL, isDark }) {
  const isEdit = !!template?.id;
  const [form, setForm] = useState({
    name: template?.name || '',
    nameAr: template?.nameAr || '',
    body: template?.body || '',
    bodyAr: template?.bodyAr || '',
    category: template?.category || 'custom',
    variables: template?.variables || [],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const insertVariable = (field, varKey) => {
    const tag = `{${varKey}}`;
    set(field, form[field] + tag);
    if (!form.variables.includes(varKey)) {
      set('variables', [...form.variables, varKey]);
    }
  };

  // Auto-detect variables from body text
  useEffect(() => {
    const allText = form.body + ' ' + form.bodyAr;
    const found = AVAILABLE_VARIABLES.filter(v => allText.includes(`{${v.key}}`)).map(v => v.key);
    setForm(f => ({ ...f, variables: found }));
  }, [form.body, form.bodyAr]);

  const previewEn = renderBody(form.body, SAMPLE_DATA);
  const previewAr = renderBody(form.bodyAr, SAMPLE_DATA);
  const charCountEn = form.body.length;
  const charCountAr = form.bodyAr.length;
  const smsCountEn = Math.ceil(charCountEn / 160) || 0;
  const smsCountAr = Math.ceil(charCountAr / 160) || 0;

  const canSave = form.name.trim() && form.body.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave(form);
  };

  // ESC close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const modal = {
    background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto',
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.08)'}`,
  };
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
    background: isDark ? '#0a1929' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, display: 'block' };
  const textareaStyle = { ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' };

  return (
    <div style={overlay} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isEdit ? (isRTL ? 'تعديل القالب' : 'Edit Template') : (isRTL ? 'قالب جديد' : 'New Template')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name EN + AR */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{isRTL ? 'الاسم (EN)' : 'Name (EN)'}</label>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Welcome Message" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{isRTL ? 'الاسم (AR)' : 'Name (AR)'}</label>
              <input style={inputStyle} value={form.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder="رسالة ترحيب" dir="rtl" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>{isRTL ? 'التصنيف' : 'Category'}</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{isRTL ? c.ar : c.en}</option>)}
            </select>
          </div>

          {/* Variable insertion buttons */}
          <div>
            <label style={labelStyle}>{isRTL ? 'إدراج متغير' : 'Insert Variable'}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVAILABLE_VARIABLES.map(v => (
                <button key={v.key} onClick={() => insertVariable('body', v.key)} style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  background: form.variables.includes(v.key) ? '#4A7AAB18' : (isDark ? '#0a1929' : '#f8fafc'),
                  border: `1px solid ${form.variables.includes(v.key) ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0')}`,
                  color: form.variables.includes(v.key) ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                }}>
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Body EN */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>{isRTL ? 'نص الرسالة (EN)' : 'Message Body (EN)'}</label>
              <span style={{ fontSize: 11, color: charCountEn > 160 ? '#EF4444' : (isDark ? '#94a3b8' : '#64748b') }}>
                {charCountEn}/160 {smsCountEn > 1 ? `(${smsCountEn} SMS)` : ''}
              </span>
            </div>
            <textarea style={textareaStyle} value={form.body} onChange={e => set('body', e.target.value)}
              placeholder="Hi {client_name}, ..." />
          </div>

          {/* Body AR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>{isRTL ? 'نص الرسالة (AR)' : 'Message Body (AR)'}</label>
              <span style={{ fontSize: 11, color: charCountAr > 160 ? '#EF4444' : (isDark ? '#94a3b8' : '#64748b') }}>
                {charCountAr}/160 {smsCountAr > 1 ? `(${smsCountAr} SMS)` : ''}
              </span>
            </div>
            <textarea style={textareaStyle} value={form.bodyAr} onChange={e => set('bodyAr', e.target.value)}
              placeholder="مرحباً {client_name}، ..." dir="rtl" />
          </div>

          {/* Live Preview */}
          {(form.body || form.bodyAr) && (
            <div style={{
              borderRadius: 12, padding: 14,
              background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)',
              border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4A7AAB', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye size={12} /> {isRTL ? 'معاينة حية' : 'Live Preview'}
              </div>
              {previewEn && (
                <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: form.bodyAr ? 8 : 0, lineHeight: 1.6 }}>
                  <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>EN:</span> {previewEn}
                </div>
              )}
              {previewAr && (
                <div style={{ fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', lineHeight: 1.6 }} dir="rtl">
                  <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>AR:</span> {previewAr}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px',
          borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
            background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', fontSize: 13, cursor: 'pointer',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={!canSave} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
            background: canSave ? '#4A7AAB' : '#4A7AAB60', color: '#fff', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, opacity: canSave ? 1 : 0.6,
          }}>
            <Check size={14} />
            {isEdit ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إنشاء القالب' : 'Create Template')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Send Test Modal ───────────────────────────────────────────────────
function SendTestModal({ template, onClose, onSend, isRTL, isDark }) {
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState(isRTL ? 'ar' : 'en');
  const preview = renderBody(lang === 'ar' ? (template.bodyAr || template.body) : template.body, SAMPLE_DATA);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const modal = {
    background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 420, border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.08)'}`,
  };
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
    background: isDark ? '#0a1929' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={overlay} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'إرسال تجريبي' : 'Send Test SMS'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, display: 'block' }}>
              {isRTL ? 'رقم الهاتف' : 'Phone Number'}
            </label>
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+201001234567" dir="ltr" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['en', 'ar'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: lang === l ? '#4A7AAB18' : 'transparent',
                border: `1px solid ${lang === l ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0')}`,
                color: lang === l ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
              }}>
                {l === 'en' ? 'English' : 'عربي'}
              </button>
            ))}
          </div>
          <div style={{
            borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.6,
            background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)',
            border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'}`,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {preview}
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px',
          borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
            background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, cursor: 'pointer',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => { if (phone.trim()) onSend(phone.trim(), preview); }} disabled={!phone.trim()} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600,
            background: phone.trim() ? '#4A7AAB' : '#4A7AAB60', color: '#fff',
            cursor: phone.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 5,
            opacity: phone.trim() ? 1 : 0.6,
          }}>
            <Send size={13} /> {isRTL ? 'إرسال' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Send Modal ───────────────────────────────────────────────────
function BulkSendModal({ template, onClose, onSend, isRTL, isDark }) {
  const [contactSearch, setContactSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [lang, setLang] = useState(isRTL ? 'ar' : 'en');
  const [sent, setSent] = useState(false);

  // Get contacts from localStorage
  const allContacts = useMemo(() => {
    try {
      return []
        .filter(c => c.phone && !c.is_blacklisted)
        .slice(0, 200);
    } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    if (!contactSearch) return allContacts.slice(0, 50);
    const q = contactSearch.toLowerCase();
    return allContacts.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    ).slice(0, 50);
  }, [allContacts, contactSearch]);

  const toggleContact = (c) => {
    setSelected(prev => prev.find(s => s.id === c.id) ? prev.filter(s => s.id !== c.id) : [...prev, c]);
  };
  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected([...filtered]);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const modal = {
    background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto',
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.08)'}`,
  };

  return (
    <div style={overlay} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'إرسال جماعي' : 'Bulk Send'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 18px' }}>
          {/* Template info */}
          <div style={{
            borderRadius: 10, padding: 10, marginBottom: 12,
            background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)',
            border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4A7AAB', marginBottom: 4 }}>
              {isRTL ? (template.nameAr || template.name) : template.name}
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1.5 }}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              {lang === 'ar' ? (template.bodyAr || template.body) : template.body}
            </div>
          </div>

          {/* Language toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['en', 'ar'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: lang === l ? '#4A7AAB18' : 'transparent',
                border: `1px solid ${lang === l ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0')}`,
                color: lang === l ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
              }}>
                {l === 'en' ? 'English' : 'عربي'}
              </button>
            ))}
          </div>

          {/* Contact search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} color={isDark ? '#94a3b8' : '#64748b'} style={{ position: 'absolute', top: 9, left: isRTL ? undefined : 10, right: isRTL ? 10 : undefined }} />
            <input
              value={contactSearch} onChange={e => setContactSearch(e.target.value)}
              placeholder={isRTL ? 'بحث جهات الاتصال...' : 'Search contacts...'}
              style={{
                width: '100%', padding: '7px 12px', paddingLeft: isRTL ? 12 : 32, paddingRight: isRTL ? 32 : 12,
                borderRadius: 10, fontSize: 12, boxSizing: 'border-box',
                border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
                background: isDark ? '#0a1929' : '#f8fafc', color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none',
              }}
            />
          </div>

          {/* Select all */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <button onClick={toggleAll} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              color: '#4A7AAB', padding: 0,
            }}>
              {selected.length === filtered.length ? (isRTL ? 'إلغاء الكل' : 'Deselect All') : (isRTL ? 'تحديد الكل' : 'Select All')}
            </button>
            <span style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
              {selected.length} {isRTL ? 'مختار' : 'selected'}
            </span>
          </div>

          {/* Contact list */}
          <div style={{
            maxHeight: 220, overflowY: 'auto', borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e2e8f0'}`,
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'لا توجد جهات اتصال' : 'No contacts found'}
              </div>
            ) : filtered.map(c => {
              const isSelected = selected.find(s => s.id === c.id);
              return (
                <div key={c.id} onClick={() => toggleContact(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
                  borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.08)' : '#f1f5f9'}`,
                  background: isSelected ? (isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.04)') : 'transparent',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.3)' : '#cbd5e1')}`,
                    background: isSelected ? '#4A7AAB' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <Check size={11} color="#fff" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.full_name || c.name || (isRTL ? 'بدون اسم' : 'No Name')}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }} dir="ltr">{c.phone}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px',
          borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'}`,
            background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, cursor: 'pointer',
          }}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => { if (selected.length > 0) { onSend(selected, lang); setSent(true); } }} disabled={selected.length === 0 || sent} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600,
            background: (selected.length > 0 && !sent) ? '#4A7AAB' : '#4A7AAB60', color: '#fff',
            cursor: (selected.length > 0 && !sent) ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 5, opacity: (selected.length > 0 && !sent) ? 1 : 0.6,
          }}>
            <Send size={13} />
            {sent ? (isRTL ? 'تم الإرسال!' : 'Sent!') : (isRTL ? `إرسال (${selected.length})` : `Send (${selected.length})`)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────
function PreviewModal({ template, onClose, isRTL, isDark }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const previewEn = renderBody(template.body, SAMPLE_DATA);
  const previewAr = renderBody(template.bodyAr || '', SAMPLE_DATA);

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const modal = {
    background: isDark ? '#1a2332' : '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 440,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.08)'}`,
  };

  return (
    <div style={overlay} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#f1f5f9'}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'معاينة القالب' : 'Template Preview'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 6 }}>
            {isRTL ? (template.nameAr || template.name) : template.name}
          </div>
          <div style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 14,
            background: (CAT_COLORS[template.category] || '#6B8DB5') + '18',
            color: CAT_COLORS[template.category] || '#6B8DB5',
          }}>
            {isRTL ? CATEGORIES.find(c => c.id === template.category)?.ar : CATEGORIES.find(c => c.id === template.category)?.en}
          </div>

          {/* Phone mockup */}
          <div style={{
            background: isDark ? '#0a1929' : '#f8fafc', borderRadius: 16, padding: 16,
            border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e2e8f0'}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#4A7AAB', marginBottom: 8 }}>English</div>
            <div style={{
              background: isDark ? '#132337' : '#ffffff', borderRadius: 12, padding: 12,
              fontSize: 12, lineHeight: 1.7, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 10,
              border: `1px solid ${isDark ? 'rgba(74,122,171,0.1)' : '#f1f5f9'}`,
            }}>
              {previewEn}
            </div>
            {previewAr && (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#4A7AAB', marginBottom: 8 }}>عربي</div>
                <div style={{
                  background: isDark ? '#132337' : '#ffffff', borderRadius: 12, padding: 12,
                  fontSize: 12, lineHeight: 1.7, color: isDark ? '#e2e8f0' : '#1e293b',
                  border: `1px solid ${isDark ? 'rgba(74,122,171,0.1)' : '#f1f5f9'}`,
                }} dir="rtl">
                  {previewAr}
                </div>
              </>
            )}
          </div>

          {/* Variables */}
          {template.variables?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
                {isRTL ? 'المتغيرات' : 'Variables'}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {template.variables.map(v => (
                  <span key={v} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500,
                    background: '#4A7AAB15', color: '#4A7AAB', border: '1px solid #4A7AAB30',
                  }}>
                    {`{${v}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function SMSTemplatesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  const userName = profile?.full_name_en || profile?.full_name_ar || 'System';

  const [tab, setTab] = useState('templates'); // templates | log
  const [templates, setTemplates] = useState([]);
  const [smsLog, setSmsLog] = useState([]);
  const [showModal, setShowModal] = useState(null); // null | 'new' | template obj
  const [showTest, setShowTest] = useState(null);
  const [showBulk, setShowBulk] = useState(null);
  const [showPreview, setShowPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Audit filter
  const { auditFields, applyAuditFilters } = useAuditFilter('sms_template');

  // Load data
  const reload = async () => {
    try { const t = await getTemplates(); setTemplates(Array.isArray(t) ? t : []); } catch { setTemplates([]); }
    try { const l = await getSMSLog(); setSmsLog(Array.isArray(l) ? l : []); } catch { setSmsLog([]); }
  };
  useEffect(() => { reload(); }, []);

  // SmartFilter fields
  const SMART_FIELDS = useMemo(() => [
    {
      id: 'category', label: 'التصنيف', labelEn: 'Category', type: 'select',
      options: CATEGORIES.map(c => ({ value: c.id, label: c.ar, labelEn: c.en })),
    },
    { id: 'send_count', label: 'عدد الإرسال', labelEn: 'Send Count', type: 'number' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let data = [...templates];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.nameAr || '').toLowerCase().includes(q) ||
        (t.body || '').toLowerCase().includes(q)
      );
    }
    data = applySmartFilters(data, filters.filter(f => !f.field?.startsWith('_audit_')), SMART_FIELDS);
    data = applyAuditFilters(data, filters);
    return data;
  }, [templates, search, filters, SMART_FIELDS, applyAuditFilters]);

  // Filtered log
  const filteredLog = useMemo(() => {
    let data = [...smsLog];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(l =>
        (l.phone || '').toLowerCase().includes(q) ||
        (l.message || '').toLowerCase().includes(q) ||
        (l.template_name || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [smsLog, search]);

  const currentData = tab === 'templates' ? filteredTemplates : filteredLog;
  const totalPages = Math.ceil(currentData.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const pageData = currentData.slice((safePage - 1) * pageSize, safePage * pageSize);

  // KPI data
  const totalTemplates = (templates || []).length;
  const totalSent = smsLog.length;
  const today = new Date().toISOString().slice(0, 10);
  const todaySent = smsLog.filter(l => (l.sent_at || '').slice(0, 10) === today).length;
  const mostUsed = (templates || []).reduce((best, t) => (!best || t.send_count > best.send_count) ? t : best, null);

  // Handlers
  const handleSave = (form) => {
    if (showModal?.id) {
      const old = { ...showModal };
      updateTemplate(showModal.id, form);
      logAction({ action: 'update', entity: 'sms_template', entityId: showModal.id, entityName: form.name, description: `Updated SMS template: ${form.name}`, userName });
      toast.success(isRTL ? 'تم تحديث القالب' : 'Template updated');
    } else {
      const created = createTemplate(form);
      logAction({ action: 'create', entity: 'sms_template', entityId: created.id, entityName: form.name, description: `Created SMS template: ${form.name}`, userName });
      toast.success(isRTL ? 'تم إنشاء القالب' : 'Template created');
    }
    setShowModal(null);
    reload();
  };

  const handleDelete = (t) => {
    if (!confirm(isRTL ? `حذف القالب "${t.nameAr || t.name}"?` : `Delete template "${t.name}"?`)) return;
    deleteTemplate(t.id);
    logAction({ action: 'delete', entity: 'sms_template', entityId: t.id, entityName: t.name, description: `Deleted SMS template: ${t.name}`, userName });
    toast.success(isRTL ? 'تم حذف القالب' : 'Template deleted');
    reload();
  };

  const handleSendTest = (phone, message) => {
    sendSMS(phone, message, showTest.id, showTest.name);
    logAction({ action: 'create', entity: 'sms_send', entityId: showTest.id, entityName: showTest.name, description: `Test SMS sent to ${phone}`, userName });
    toast.success(isRTL ? 'تم إرسال الرسالة التجريبية' : 'Test SMS sent');
    setShowTest(null);
    reload();
  };

  const handleBulkSend = (contacts, lang) => {
    const results = bulkSend(showBulk.id, contacts, lang);
    logAction({ action: 'create', entity: 'sms_bulk', entityId: showBulk.id, entityName: showBulk.name, description: `Bulk SMS sent to ${results.length} contacts`, userName });
    toast.success(isRTL ? `تم إرسال ${results.length} رسالة` : `${results.length} messages sent`);
    setTimeout(() => { setShowBulk(null); reload(); }, 1200);
  };

  // Styles
  const pageBg = isDark ? '#0a1929' : '#f8fafc';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const borderColor = isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ padding: '20px 24px', minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={22} color="#4A7AAB" />
            {isRTL ? 'قوالب الرسائل القصيرة' : 'SMS Templates'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: textSecondary }}>
            {isRTL ? 'إنشاء وإدارة قوالب الرسائل النصية' : 'Create and manage SMS message templates'}
          </p>
        </div>
        <button onClick={() => setShowModal('new')} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10,
          border: 'none', cursor: 'pointer', background: '#4A7AAB', color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={15} />
          {isRTL ? 'قالب جديد' : 'New Template'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <KpiCard icon={FileText} label={isRTL ? 'إجمالي القوالب' : 'Total Templates'} value={totalTemplates} color="#4A7AAB" isDark={isDark} />
        <KpiCard icon={Send} label={isRTL ? 'إجمالي المرسل' : 'Total Sent'} value={totalSent} color="#10B981" isDark={isDark} />
        <KpiCard icon={Clock} label={isRTL ? 'مرسل اليوم' : "Today's Sent"} value={todaySent} color="#F59E0B" isDark={isDark} />
        <KpiCard icon={TrendingUp} label={isRTL ? 'الأكثر استخداماً' : 'Most Used'} value={mostUsed ? (isRTL ? (mostUsed.nameAr || mostUsed.name) : mostUsed.name) : '—'} color="#8B5CF6" isDark={isDark} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: `2px solid ${borderColor}` }}>
        {[
          { id: 'templates', label: isRTL ? 'القوالب' : 'Templates', icon: FileText },
          { id: 'log', label: isRTL ? 'سجل الإرسال' : 'SMS Log', icon: Clock },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setPage(1); setSearch(''); setFilters([]); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', cursor: 'pointer',
            background: 'transparent', border: 'none', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? '#4A7AAB' : textSecondary,
            borderBottom: tab === t.id ? '2px solid #4A7AAB' : '2px solid transparent',
            marginBottom: -2,
          }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={tab === 'templates' ? SMART_FIELDS : []}
        filters={filters}
        onFiltersChange={setFilters}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={isRTL ? 'بحث في القوالب...' : 'Search templates...'}
        resultsCount={currentData.length}
      />

      {/* Templates Tab */}
      {tab === 'templates' && (
        <>
          {filteredTemplates.length === 0 ? (
            <EmptyState isRTL={isRTL} isDark={isDark} onAdd={() => setShowModal('new')} />
          ) : (
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              border: `1px solid ${borderColor}`,
              background: cardBg,
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 140px', gap: 0,
                padding: '10px 16px', borderBottom: `1px solid ${borderColor}`,
                background: isDark ? '#132337' : '#f8fafc',
              }}>
                {[
                  isRTL ? 'الاسم' : 'Name',
                  isRTL ? 'التصنيف' : 'Category',
                  isRTL ? 'المتغيرات' : 'Variables',
                  isRTL ? 'المرسل' : 'Sent',
                  isRTL ? 'التاريخ' : 'Created',
                  isRTL ? 'إجراءات' : 'Actions',
                ].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: textSecondary }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {pageData.map(t => (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 140px', gap: 0,
                  padding: '12px 16px', borderBottom: `1px solid ${borderColor}`,
                  alignItems: 'center',
                }}>
                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, marginBottom: 2 }}>
                      {isRTL ? (t.nameAr || t.name) : t.name}
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {isRTL ? (t.bodyAr || t.body) : t.body}
                    </div>
                  </div>
                  {/* Category */}
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, width: 'fit-content',
                    background: (CAT_COLORS[t.category] || '#6B8DB5') + '18',
                    color: CAT_COLORS[t.category] || '#6B8DB5',
                  }}>
                    {isRTL ? CATEGORIES.find(c => c.id === t.category)?.ar : CATEGORIES.find(c => c.id === t.category)?.en}
                  </span>
                  {/* Variables */}
                  <span style={{ fontSize: 12, color: textSecondary }}>{t.variables?.length || 0}</span>
                  {/* Send count */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#4A7AAB' }}>{t.send_count || 0}</span>
                  {/* Created */}
                  <span style={{ fontSize: 11, color: textSecondary }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-GB') : '—'}
                  </span>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setShowPreview(t)} title={isRTL ? 'معاينة' : 'Preview'} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`,
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: textSecondary,
                    }}>
                      <Eye size={13} />
                    </button>
                    <button onClick={() => setShowModal(t)} title={isRTL ? 'تعديل' : 'Edit'} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`,
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#4A7AAB',
                    }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setShowTest(t)} title={isRTL ? 'إرسال تجريبي' : 'Send Test'} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`,
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#10B981',
                    }}>
                      <Send size={13} />
                    </button>
                    <button onClick={() => setShowBulk(t)} title={isRTL ? 'إرسال جماعي' : 'Bulk Send'} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`,
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#F59E0B',
                    }}>
                      <Users size={13} />
                    </button>
                    <button onClick={() => handleDelete(t)} title={isRTL ? 'حذف' : 'Delete'} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`,
                      background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#EF4444',
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <Pagination
                page={safePage} totalPages={totalPages} onPageChange={setPage}
                pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                totalItems={filteredTemplates.length} safePage={safePage}
              />
            </div>
          )}
        </>
      )}

      {/* SMS Log Tab */}
      {tab === 'log' && (
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          border: `1px solid ${borderColor}`, background: cardBg,
        }}>
          {filteredLog.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', fontSize: 13, color: textSecondary }}>
              {isRTL ? 'لا توجد رسائل مرسلة' : 'No messages sent yet'}
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr', gap: 0,
                padding: '10px 16px', borderBottom: `1px solid ${borderColor}`,
                background: isDark ? '#132337' : '#f8fafc',
              }}>
                {[
                  isRTL ? 'التاريخ' : 'Date',
                  isRTL ? 'الرسالة' : 'Message',
                  isRTL ? 'الهاتف' : 'Phone',
                  isRTL ? 'القالب' : 'Template',
                  isRTL ? 'الحالة' : 'Status',
                ].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: textSecondary }}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {pageData.map(l => (
                <div key={l.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr 1.5fr 1fr 1fr', gap: 0,
                  padding: '10px 16px', borderBottom: `1px solid ${borderColor}`,
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: textSecondary }}>
                    {l.sent_at ? new Date(l.sent_at).toLocaleString(isRTL ? 'ar-EG' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span style={{ fontSize: 12, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.message}
                  </span>
                  <span style={{ fontSize: 12, color: textSecondary }} dir="ltr">{l.phone}</span>
                  <span style={{ fontSize: 11, color: '#4A7AAB', fontWeight: 500 }}>{l.template_name || '—'}</span>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, width: 'fit-content',
                    background: l.status === 'sent' ? '#10B98118' : '#EF444418',
                    color: l.status === 'sent' ? '#10B981' : '#EF4444',
                  }}>
                    {l.status === 'sent' ? (isRTL ? 'مرسل' : 'Sent') : (isRTL ? 'فشل' : 'Failed')}
                  </span>
                </div>
              ))}
              <Pagination
                page={safePage} totalPages={totalPages} onPageChange={setPage}
                pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                totalItems={filteredLog.length} safePage={safePage}
              />
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <TemplateModal
          template={showModal === 'new' ? null : showModal}
          onClose={() => setShowModal(null)}
          onSave={handleSave}
          isRTL={isRTL} isDark={isDark}
        />
      )}
      {showTest && (
        <SendTestModal
          template={showTest}
          onClose={() => setShowTest(null)}
          onSend={handleSendTest}
          isRTL={isRTL} isDark={isDark}
        />
      )}
      {showBulk && (
        <BulkSendModal
          template={showBulk}
          onClose={() => setShowBulk(null)}
          onSend={handleBulkSend}
          isRTL={isRTL} isDark={isDark}
        />
      )}
      {showPreview && (
        <PreviewModal
          template={showPreview}
          onClose={() => setShowPreview(null)}
          isRTL={isRTL} isDark={isDark}
        />
      )}
    </div>
  );
}
