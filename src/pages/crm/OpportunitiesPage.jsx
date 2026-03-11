import { useState, useRef, useEffect, useCallback } from "react";
import FollowUpReminder from '../../components/ui/FollowUpReminder';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects, searchContacts } from '../../services/opportunitiesService';
import { createDealFromOpportunity } from '../../services/dealsService';
import { TrendingUp, Plus, Search, X, MoreHorizontal, Trash2, Building2, Banknote, User, Grid3X3, Flame, Loader2 } from 'lucide-react';

const STAGE_CONFIG = [
  { id: "all",                  label_ar: "الكل",            label_en: "All",             color: "#4A7AAB" },
  { id: "new",                  label_ar: "جديد",            label_en: "New",             color: "#4A7AAB" },
  { id: "contacted",            label_ar: "تم التواصل",      label_en: "Contacted",       color: "#4A7AAB" },
  { id: "interested",           label_ar: "مهتم",            label_en: "Interested",      color: "#4A7AAB" },
  { id: "site_visit_scheduled", label_ar: "موعد معاينة",     label_en: "Visit Scheduled", color: "#2B4C6F" },
  { id: "site_visited",         label_ar: "تمت المعاينة",    label_en: "Site Visited",    color: "#2B4C6F" },
  { id: "negotiation",          label_ar: "تفاوض",           label_en: "Negotiation",     color: "#1B3347" },
  { id: "reserved",             label_ar: "محجوز",           label_en: "Reserved",        color: "#1B3347" },
  { id: "closed_won",           label_ar: "تم الإغلاق",      label_en: "Closed Won",      color: "#10B981" },
  { id: "closed_lost",          label_ar: "خسارة",           label_en: "Closed Lost",     color: "#EF4444" },
];
const TEMP_CONFIG = {
  hot:  { label_ar: "ساخن", label_en: "Hot",  color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
  warm: { label_ar: "دافئ", label_en: "Warm", color: "#F97316", bg: "rgba(249,115,22,0.10)" },
  cool: { label_ar: "عادي", label_en: "Cool", color: "#8BA8C8", bg: "rgba(139,168,200,0.10)" },
  cold: { label_ar: "بارد", label_en: "Cold", color: "#4A7AAB", bg: "rgba(74,122,171,0.10)" },
};
const PRIORITY_CONFIG = {
  urgent: { label_ar: "عاجل",  label_en: "Urgent", color: "#EF4444" },
  high:   { label_ar: "عالي",  label_en: "High",   color: "#4A7AAB" },
  medium: { label_ar: "متوسط", label_en: "Medium", color: "#6B8DB5" },
  low:    { label_ar: "منخفض", label_en: "Low",    color: "#8BA8C8" },
};

const fmtBudget = (n) => { if (!n) return "-"; if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(0) + "K"; return n.toLocaleString(); };
const initials = (n) => (n || "").trim().split(" ").map(w => w[0]).slice(0, 2).join("") || "?";
const ACOLORS = ["#1B3347", "#2B4C6F", "#4A7AAB", "#6B8DB5", "#8BA8C8"];
const avatarColor = (id) => ACOLORS[(id || 0) % ACOLORS.length];

const actLabel = (createdAt, isRTL) => {
  if (!createdAt) return { text: '—', color: '#8BA8C8' };
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return { text: isRTL ? "اليوم" : "Today", color: "#4A7AAB" };
  if (days === 1) return { text: isRTL ? "أمس" : "Yesterday", color: "#6B8DB5" };
  if (days <= 3) return { text: days + (isRTL ? "د" : "d"), color: "#8BA8C8" };
  return { text: days + (isRTL ? "د" : "d"), color: "#EF4444" };
};

// ─── Helper to get display name ───
const getContactName = (opp) => opp.contacts?.full_name || opp.contact_name || '—';
const getAgentName = (opp, lang) => {
  if (opp.users) return lang === 'ar' ? opp.users.full_name_ar : (opp.users.full_name_en || opp.users.full_name_ar);
  return opp.agent_name || '—';
};
const getProjectName = (opp, lang) => {
  if (opp.projects) return lang === 'ar' ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar);
  return opp.project_name || '';
};

// ═══════════════════════════════════════════════
// OppCard — cleaned up, no duplicate stage display
// ═══════════════════════════════════════════════
function OppCard({ opp, isDark, isRTL, lang, onDelete, onMove, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
  const prio = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
  const stage = STAGE_CONFIG.find(s => s.id === opp.stage) || STAGE_CONFIG[1];
  const act = actLabel(opp.updated_at || opp.created_at, isRTL);
  const contactName = getContactName(opp);
  const agentName = getAgentName(opp, lang);
  const projectName = getProjectName(opp, lang);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  return (
    <div onClick={() => onSelect(opp)} style={{
      background: isDark ? "#1a2234" : "#fff", border: `1px solid ${isDark ? "rgba(74,122,171,0.15)" : "#e5e7eb"}`,
      borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden", cursor: "pointer",
      boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(27,51,71,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}
    >
      {/* Color bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: stage.color, borderRadius: "14px 14px 0 0" }} />

      {/* Header: Name + Menu */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: avatarColor(opp.contact_id || opp.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>{initials(contactName)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#E2EAF4" : "#1B3347", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contactName}</div>
            {opp.contacts?.phone && <div style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af', direction: 'ltr' }}>{opp.contacts.phone}</div>}
          </div>
        </div>
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }} style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#8BA8C8" : "#9ca3af", padding: 4, borderRadius: 6, display: "flex" }}>
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div style={{ position: "absolute", [isRTL ? "left" : "right"]: 0, top: "100%", zIndex: 50, background: isDark ? "#0F1E2D" : "#fff", border: `1px solid ${isDark ? "rgba(74,122,171,0.2)" : "#e5e7eb"}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 170, overflow: "hidden" }}>
              <div style={{ padding: "6px 0", borderBottom: `1px solid ${isDark ? "rgba(74,122,171,0.1)" : "#f3f4f6"}` }}>
                <div style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, color: isDark ? "#8BA8C8" : "#9ca3af" }}>{isRTL ? "نقل الى" : "Move to"}</div>
                {STAGE_CONFIG.filter(s => s.id !== "all" && s.id !== opp.stage).slice(0, 5).map(s => (
                  <button key={s.id} onClick={e => { e.stopPropagation(); onMove(opp.id, s.id); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: isDark ? "#E2EAF4" : "#1A2B3C", fontFamily: "inherit", textAlign: isRTL ? "right" : "left" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    {isRTL ? s.label_ar : s.label_en}
                  </button>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(opp.id); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#ef4444", fontFamily: "inherit" }}>
                <Trash2 size={13} />{isRTL ? "حذف" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project */}
      {projectName && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: isDark ? "#8BA8C8" : "#6b7280" }}><Building2 size={12} style={{ flexShrink: 0 }} /><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{projectName}</span></div>}

      {/* Tags: Budget + Temp + Priority */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: isDark ? "rgba(74,122,171,0.1)" : "rgba(74,122,171,0.08)", borderRadius: 6, padding: "4px 9px", fontSize: 12, fontWeight: 700, color: "#4A7AAB" }}>
          <Banknote size={11} />{fmtBudget(opp.budget)} {isRTL ? "ج" : "EGP"}
        </div>
        <div style={{ borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 600, background: temp.bg, color: temp.color }}>{isRTL ? temp.label_ar : temp.label_en}</div>
        <div style={{ borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 600, background: `${prio.color}18`, color: prio.color }}>{isRTL ? prio.label_ar : prio.label_en}</div>
      </div>

      {/* Footer: Agent + Last Activity */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${isDark ? "rgba(74,122,171,0.1)" : "#f3f4f6"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: isDark ? "#8BA8C8" : "#6b7280" }}><User size={11} />{agentName}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: act.color }}>{act.text}</div>
      </div>

      {/* Notes */}
      {opp.notes && <div style={{ fontSize: 11, color: isDark ? "#8BA8C8" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: -4 }}>{opp.notes}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ContactSearch — search & select real contacts
// ═══════════════════════════════════════════════
function ContactSearch({ isDark, isRTL, value, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const data = await searchContacts(q);
    setResults(data);
    setSearching(false);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1B3347', fontSize: 13, outline: 'none', fontFamily: 'inherit' };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {value ? (
        <div style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{value.full_name} {value.phone ? `(${value.phone})` : ''}</span>
          <button onClick={() => { onSelect(null); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6B8DB5' : '#9ca3af', padding: 0 }}><X size={14} /></button>
        </div>
      ) : (
        <input style={inp} value={query} onChange={handleChange} onFocus={() => query.length >= 2 && setOpen(true)} placeholder={isRTL ? 'ابحث عن جهة اتصال...' : 'Search contacts...'} />
      )}
      {open && !value && (query.length >= 2) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: isDark ? '#0F1E2D' : '#fff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 60, maxHeight: 200, overflowY: 'auto' }}>
          {searching ? (
            <div style={{ padding: 16, textAlign: 'center', color: isDark ? '#6B8DB5' : '#9ca3af', fontSize: 12 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
          ) : results.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: isDark ? '#6B8DB5' : '#9ca3af', fontSize: 12 }}>{isRTL ? 'لا توجد نتائج' : 'No results'}</div>
          ) : (
            results.map(c => (
              <button key={c.id} onClick={() => { onSelect(c); setOpen(false); setQuery(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: isDark ? '#E2EAF4' : '#1B3347', fontFamily: 'inherit', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(c.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(c.full_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af', direction: 'ltr' }}>{c.phone || c.email || ''}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// AddModal — with real contact search & agent select
// ═══════════════════════════════════════════════
function AddModal({ isDark, isRTL, lang, onClose, onSave, agents, projects }) {
  const [form, setForm] = useState({ contact: null, budget: '', assigned_to: '', temperature: 'hot', priority: 'medium', stage: 'new', project_id: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1B3347', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
  const lbl = (t) => <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#8BA8C8' : '#6b7280', marginBottom: 4, display: 'block' }}>{t}</label>;

  const handleSave = async () => {
    if (!form.contact) return;
    setSaving(true);
    const payload = {
      contact_id: form.contact.id,
      budget: Number(form.budget) || 0,
      assigned_to: form.assigned_to || null,
      temperature: form.temperature,
      priority: form.priority,
      stage: form.stage,
      project_id: form.project_id || null,
      notes: form.notes,
    };
    const result = await createOpportunity(payload);
    onSave(result);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content" style={{ position: 'relative', width: 520, maxHeight: '90vh', overflowY: 'auto', background: isDark ? '#1a2234' : '#fff', borderRadius: 16, padding: 24, zIndex: 1, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#E2EAF4' : '#1B3347' }}>{isRTL ? 'إضافة فرصة جديدة' : 'Add New Opportunity'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#8BA8C8' : '#6b7280', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="modal-grid">
          <div style={{ gridColumn: 'span 2' }}>
            {lbl(isRTL ? 'جهة الاتصال *' : 'Contact *')}
            <ContactSearch isDark={isDark} isRTL={isRTL} value={form.contact} onSelect={c => f('contact', c)} />
          </div>
          <div>
            {lbl(isRTL ? 'الميزانية' : 'Budget')}
            <input style={inp} type="number" value={form.budget} onChange={e => f('budget', e.target.value)} />
          </div>
          <div>
            {lbl(isRTL ? 'المسؤول' : 'Agent')}
            <select style={inp} value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
              <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
              {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
            </select>
          </div>
          <div>
            {lbl(isRTL ? 'المشروع' : 'Project')}
            <select style={inp} value={form.project_id} onChange={e => f('project_id', e.target.value)}>
              <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
            </select>
          </div>
          <div>
            {lbl(isRTL ? 'المرحلة' : 'Stage')}
            <select style={inp} value={form.stage} onChange={e => f('stage', e.target.value)}>
              {STAGE_CONFIG.filter(s => s.id !== 'all').map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            {lbl(isRTL ? 'الحرارة' : 'Temperature')}
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(TEMP_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => f('temperature', k)} style={{ flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: `2px solid ${form.temperature === k ? v.color : 'transparent'}`, background: form.temperature === k ? v.bg : (isDark ? '#0F1E2D' : '#f9fafb'), color: form.temperature === k ? v.color : (isDark ? '#8BA8C8' : '#6b7280'), transition: 'all 0.15s' }}>{isRTL ? v.label_ar : v.label_en}</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            {lbl(isRTL ? 'ملاحظات' : 'Notes')}
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 70 }} value={form.notes} onChange={e => f('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleSave} disabled={!form.contact || saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: form.contact && !saving ? 'pointer' : 'not-allowed', background: form.contact ? '#1B3347' : 'rgba(74,122,171,0.2)', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isRTL ? 'حفظ' : 'Save'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, background: 'none', color: isDark ? '#8BA8C8' : '#6b7280', fontSize: 13 }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════
export default function OpportunitiesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [opps, setOpps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterTemp, setFilterTemp] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);

  const c = { bg: isDark ? '#152232' : '#f9fafb', cardBg: isDark ? '#1a2234' : '#fff', border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb', text: isDark ? '#E2EAF4' : '#111827', textMuted: isDark ? '#8BA8C8' : '#6b7280', inputBg: isDark ? '#0F1E2D' : '#fff' };

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [oppsData, agentsData, projectsData] = await Promise.all([
        fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        fetchSalesAgents(),
        fetchProjects(),
      ]);
      setOpps(oppsData);
      setAgents(agentsData);
      setProjects(projectsData);
      setLoading(false);
    };
    load();
  }, [profile?.role, profile?.id, profile?.team_id]);

  const totalBudget = opps.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = opps.filter(o => o.stage === 'closed_won').length;
  const hotCount = opps.filter(o => o.temperature === 'hot').length;

  const filtered = opps.filter(o => {
    if (activeStage !== 'all' && o.stage !== activeStage) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = getContactName(o).toLowerCase();
      const project = getProjectName(o, lang).toLowerCase();
      if (!name.includes(q) && !project.includes(q)) return false;
    }
    if (filterAgent !== 'all' && o.assigned_to !== filterAgent) return false;
    if (filterTemp !== 'all' && o.temperature !== filterTemp) return false;
    return true;
  });

  const handleMove = async (id, toStage) => {
    setOpps(p => p.map(o => o.id === id ? { ...o, stage: toStage } : o));
    if (selectedOpp?.id === id) setSelectedOpp(p => ({ ...p, stage: toStage }));
    await updateOpportunity(id, { stage: toStage }).catch(() => {});

    // Auto-create deal in Operations when closed_won
    if (toStage === 'closed_won') {
      const opp = opps.find(o => o.id === id);
      if (opp) {
        const deal = createDealFromOpportunity({ ...opp, stage: toStage });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  const handleDelete = async (id) => {
    setOpps(p => p.filter(o => o.id !== id));
    if (selectedOpp?.id === id) setSelectedOpp(null);
    await deleteOpportunity(id).catch(() => {});
  };

  const handleSave = (opp) => {
    setOpps(p => [opp, ...p]);
    setShowModal(false);
  };

  const sel = { padding: '8px 12px', borderRadius: 8, fontSize: 13, border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' };

  return (<>
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: 'Cairo,Tajawal,sans-serif', direction: isRTL ? 'rtl' : 'ltr', padding: '20px 20px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1B3347,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Grid3X3 size={18} color="#fff" /></div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c.text }}>{isRTL ? 'الفرص البيعية' : 'Opportunities'}</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{isRTL ? 'إدارة وتتبع فرص المبيعات' : 'Manage and track sales opportunities'}</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1B3347,#2B4C6F)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(27,51,71,0.3)' }}>
          <Plus size={15} />{isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: isRTL ? 'إجمالي الفرص' : 'Total', value: opps.length, color: '#4A7AAB', I: Grid3X3 },
          { label: isRTL ? 'إجمالي الميزانيات' : 'Budget', value: fmtBudget(totalBudget) + (isRTL ? ' ج' : ' EGP'), color: '#4A7AAB', I: Banknote },
          { label: isRTL ? 'صفقات مغلقة' : 'Won', value: wonCount, color: '#10B981', I: Building2 },
          { label: isRTL ? 'فرص ساخنة' : 'Hot', value: hotCount, color: '#EF4444', I: Flame },
        ].map((s, i) => (
          <div key={i} style={{ flex: '1 1 140px', background: c.cardBg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><s.I size={16} color={s.color} /></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: c.text }}>{s.value}</div><div style={{ fontSize: 11, color: c.textMuted }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Stage Tabs */}
      <div style={{ background: c.cardBg, borderRadius: 12, padding: '10px 14px', marginBottom: 16, border: `1px solid ${c.border}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STAGE_CONFIG.map(s => {
          const count = s.id === 'all' ? opps.length : opps.filter(o => o.stage === s.id).length;
          const active = activeStage === s.id;
          return <button key={s.id} onClick={() => setActiveStage(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', background: active ? s.color : 'transparent', color: active ? '#fff' : c.textMuted, transition: 'all 0.15s' }}>
            {isRTL ? s.label_ar : s.label_en}
            <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', background: active ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(74,122,171,0.15)' : '#f3f4f6'), color: active ? '#fff' : c.textMuted }}>{count}</span>
          </button>;
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} color={c.textMuted} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 10, pointerEvents: 'none' }} />
          <input placeholder={isRTL ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} style={{ ...sel, width: '100%', boxSizing: 'border-box', [isRTL ? 'paddingRight' : 'paddingLeft']: 32 }} />
        </div>
        <select style={sel} value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="all">{isRTL ? 'كل المسؤولين' : 'All Agents'}</option>
          {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
        </select>
        <select style={sel} value={filterTemp} onChange={e => setFilterTemp(e.target.value)}>
          <option value="all">{isRTL ? 'كل الحرارة' : 'All Temps'}</option>
          {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.label_ar : v.label_en}</option>)}
        </select>
        {(search || filterAgent !== 'all' || filterTemp !== 'all') && <button onClick={() => { setSearch(''); setFilterAgent('all'); setFilterTemp('all'); }} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#ef444422', color: '#ef4444', display: 'flex' }}><X size={14} /></button>}
        <div style={{ marginInlineStart: 'auto', fontSize: 12, color: c.textMuted }}>{filtered.length} {isRTL ? 'فرصة' : 'opportunities'}</div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, padding: 16, height: 180 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', animation: 'shimmer 1.5s infinite linear', backgroundSize: '800px 100%', backgroundImage: isDark ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)' : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, borderRadius: 6, width: '70%', marginBottom: 6, background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', animation: 'shimmer 1.5s infinite linear', backgroundSize: '800px 100%', backgroundImage: isDark ? 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)' : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)' }} />
                  <div style={{ height: 10, borderRadius: 6, width: '40%', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }} />
                </div>
              </div>
              <div style={{ height: 12, borderRadius: 6, width: '50%', marginBottom: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3].map(j => <div key={j} style={{ height: 24, borderRadius: 6, flex: 1, background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0' }} />)}
              </div>
            </div>
          ))}
          <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(74,122,171,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <TrendingUp size={24} color="#4A7AAB" />
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: c.text }}>{isRTL ? 'لا توجد فرص بيع' : 'No Opportunities Found'}</p>
          <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{isRTL ? 'لم يتم إضافة أي فرص بيع بعد' : 'No sales opportunities have been added yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(opp => <OppCard key={opp.id} opp={opp} isDark={isDark} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={setSelectedOpp} />)}
        </div>
      )}

      {showModal && <AddModal isDark={isDark} isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} />}
    </div>

    {/* Deal Created Toast */}
    {dealCreatedToast && (
      <div style={{
        position: 'fixed', bottom: 24, [isRTL ? 'left' : 'right']: 24, zIndex: 300,
        background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff',
        padding: '14px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600,
        animation: 'slideUp 0.3s ease-out',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎉</div>
        <div>
          <div>{isRTL ? 'تم إنشاء صفقة جديدة!' : 'Deal created!'}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{dealCreatedToast} → {isRTL ? 'العمليات' : 'Operations'}</div>
        </div>
        <button onClick={() => setDealCreatedToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: 2, marginInlineStart: 8 }}>✕</button>
      </div>
    )}
    <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

    {/* Drawer */}
    {selectedOpp && (
      <div role="dialog" dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: isRTL ? 'row' : 'row-reverse' }} onClick={e => { if (e.target === e.currentTarget) setSelectedOpp(null); }}>
        <div style={{ width: '100%', maxWidth: 460, height: '100%', background: isDark ? '#1a2234' : '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? '#152232' : '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(selectedOpp.contact_id || selectedOpp.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{initials(getContactName(selectedOpp))}</div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#E2EAF4' : '#1B3347' }}>{getContactName(selectedOpp)}</p>
                {selectedOpp.contacts?.phone && <p style={{ margin: 0, fontSize: 12, color: isDark ? '#6B8DB5' : '#9ca3af', direction: 'ltr' }}>{selectedOpp.contacts.phone}</p>}
              </div>
            </div>
            <button onClick={() => setSelectedOpp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#8BA8C8' : '#6b7280', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
          </div>

          {/* Drawer Details */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: isRTL ? 'الميزانية' : 'Budget', value: fmtBudget(selectedOpp.budget) + ' ' + (isRTL ? 'ج' : 'EGP'), color: '#4A7AAB' },
                { label: isRTL ? 'الحرارة' : 'Temperature', value: isRTL ? (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_en, color: (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).color },
                { label: isRTL ? 'الأولوية' : 'Priority', value: isRTL ? (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_ar : (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_en, color: (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).color },
                { label: isRTL ? 'المسؤول' : 'Agent', value: getAgentName(selectedOpp, lang), color: isDark ? '#E2EAF4' : '#1B3347' },
              ].map((item, i) => (
                <div key={i} style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#F0F4F8', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: isDark ? '#8BA8C8' : '#6b7280' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Project */}
            {getProjectName(selectedOpp, lang) && (
              <div style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#F0F4F8', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: isDark ? '#8BA8C8' : '#6b7280' }}>{isRTL ? 'المشروع' : 'Project'}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#E2EAF4' : '#1B3347' }}>{getProjectName(selectedOpp, lang)}</p>
              </div>
            )}

            {/* Notes */}
            {selectedOpp.notes && (
              <div style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#F0F4F8', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: isDark ? '#8BA8C8' : '#6b7280' }}>{isRTL ? 'ملاحظات' : 'Notes'}</p>
                <p style={{ margin: 0, fontSize: 13, color: isDark ? '#E2EAF4' : '#1B3347', lineHeight: 1.6 }}>{selectedOpp.notes}</p>
              </div>
            )}

            {/* Change Stage */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: isDark ? '#8BA8C8' : '#6b7280' }}>{isRTL ? 'تغيير المرحلة' : 'Change Stage'}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STAGE_CONFIG.filter(s => s.id !== 'all').map(s => (
                  <button key={s.id} onClick={() => handleMove(selectedOpp.id, s.id)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${s.id === selectedOpp.stage ? s.color : c.border}`, background: s.id === selectedOpp.stage ? s.color + '18' : 'transparent', color: s.id === selectedOpp.stage ? s.color : isDark ? '#8BA8C8' : '#6b7280', fontSize: 11, fontWeight: s.id === selectedOpp.stage ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isRTL ? s.label_ar : s.label_en}
                  </button>
                ))}
              </div>
            </div>

            {/* Follow Up Reminder */}
            <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />
          </div>
        </div>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedOpp(null)} />
      </div>
    )}
  </>);
}
