import { useState, useRef, useEffect, useCallback } from "react";
import FollowUpReminder from '../../components/ui/FollowUpReminder';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects, searchContacts } from '../../services/opportunitiesService';
import { fetchContactActivities } from '../../services/contactsService';
import { createDealFromOpportunity } from '../../services/dealsService';
import { TrendingUp, Plus, Search, X, MoreHorizontal, Trash2, Building2, Banknote, User, Grid3X3, Flame, Loader2, Pencil, Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star, LayoutGrid, Columns } from 'lucide-react';
import { Button, Card, Input, Select, Textarea, Modal, ModalFooter, KpiCard, PageSkeleton, ExportButton } from '../../components/ui';
import { DEPT_STAGES, getDeptStages, deptStageLabel } from './contacts/constants';

const DEPT_LABELS = {
  all:        { ar: 'كل الأقسام', en: 'All Departments' },
  sales:      { ar: 'المبيعات',   en: 'Sales' },
  hr:         { ar: 'الموارد البشرية', en: 'HR' },
  marketing:  { ar: 'التسويق',    en: 'Marketing' },
  operations: { ar: 'العمليات',    en: 'Operations' },
  finance:    { ar: 'المالية',     en: 'Finance' },
};
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

const DATE_FILTERS = {
  all:        { ar: 'كل الأوقات', en: 'All Time' },
  this_week:  { ar: 'هذا الأسبوع', en: 'This Week' },
  this_month: { ar: 'هذا الشهر', en: 'This Month' },
  last_30:    { ar: 'آخر 30 يوم', en: 'Last 30 Days' },
};

const ACTIVITY_ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: UsersIcon, note: Clock, site_visit: Star };

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
function OppCard({ opp, isRTL, lang, onDelete, onMove, onSelect, stageConfig }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
  const prio = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
  const stage = stageConfig.find(s => s.id === opp.stage) || stageConfig[0] || { id: opp.stage, label_ar: opp.stage, label_en: opp.stage, color: '#4A7AAB' };
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
    <div
      onClick={() => onSelect(opp)}
      className="relative overflow-hidden rounded-xl p-4 flex flex-col gap-2.5 cursor-pointer
        bg-surface-card dark:bg-surface-card-dark
        border border-edge dark:border-edge-dark
        shadow-sm dark:shadow-md
        transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
    >
      {/* Color bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: stage.color }} />

      {/* Header: Name + Menu */}
      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-[38px] h-[38px] rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: avatarColor(opp.contact_id || opp.id) }}
          >
            {initials(contactName)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-content dark:text-content-dark truncate">{contactName}</div>
            {opp.contacts?.phone && (
              <div className="text-xs text-content-muted dark:text-content-muted-dark" dir="ltr">{opp.contacts.phone}</div>
            )}
          </div>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
            className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md flex hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div
              className="absolute top-full z-50 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg min-w-[170px] overflow-hidden"
              style={{ [isRTL ? 'left' : 'right']: 0 }}
            >
              <div className="py-1.5 border-b border-edge dark:border-edge-dark">
                <div className="px-3 py-1 text-[10px] font-semibold text-content-muted dark:text-content-muted-dark">
                  {isRTL ? "نقل الى" : "Move to"}
                </div>
                {stageConfig.filter(s => s.id !== opp.stage).slice(0, 5).map(s => (
                  <button
                    key={s.id}
                    onClick={e => { e.stopPropagation(); onMove(opp.id, s.id); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-[7px] bg-transparent border-none cursor-pointer text-xs text-content dark:text-content-dark font-cairo hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    {isRTL ? s.label_ar : s.label_en}
                  </button>
                ))}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(opp.id); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none cursor-pointer text-xs text-red-500 font-cairo hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} />{isRTL ? "حذف" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project */}
      {projectName && (
        <div className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark">
          <Building2 size={12} className="shrink-0" />
          <span className="truncate">{projectName}</span>
        </div>
      )}

      {/* Tags: Budget + Temp + Priority */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 bg-brand-500/10 rounded-md px-2.5 py-1 text-xs font-bold text-brand-500">
          <Banknote size={11} />{fmtBudget(opp.budget)} {isRTL ? "ج" : "EGP"}
        </div>
        <div
          className="rounded-md px-2.5 py-1 text-xs font-semibold"
          style={{ background: temp.bg, color: temp.color }}
        >
          {isRTL ? temp.label_ar : temp.label_en}
        </div>
        <div
          className="rounded-md px-2.5 py-1 text-xs font-semibold"
          style={{ background: `${prio.color}18`, color: prio.color }}
        >
          {isRTL ? prio.label_ar : prio.label_en}
        </div>
      </div>

      {/* Footer: Agent + Last Activity */}
      <div className="flex items-center justify-between pt-2 border-t border-edge dark:border-edge-dark">
        <div className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark">
          <User size={11} />{agentName}
        </div>
        <div className="text-xs font-bold" style={{ color: act.color }}>{act.text}</div>
      </div>

      {/* Notes */}
      {opp.notes && (
        <div className="text-xs text-content-muted dark:text-content-muted-dark truncate -mt-1">{opp.notes}</div>
      )}
      {/* Created date */}
      {opp.created_at && (
        <div className="text-[10px] text-content-muted dark:text-content-muted-dark -mt-1">
          {new Date(opp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ContactSearch — search & select real contacts
// ═══════════════════════════════════════════════
function ContactSearch({ isRTL, value, onSelect }) {
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

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-sm font-cairo flex items-center justify-between">
          <span>{value.full_name} {value.phone ? `(${value.phone})` : ''}</span>
          <button
            onClick={() => { onSelect(null); setQuery(''); }}
            className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={isRTL ? 'ابحث عن جهة اتصال...' : 'Search contacts...'}
        />
      )}
      {open && !value && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-[60] max-h-[200px] overflow-y-auto">
          {searching ? (
            <div className="p-4 text-center text-content-muted dark:text-content-muted-dark text-xs">
              <Loader2 size={16} className="animate-spin inline-block" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-content-muted dark:text-content-muted-dark text-xs">
              {isRTL ? 'لا توجد نتائج' : 'No results'}
            </div>
          ) : (
            results.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); setOpen(false); setQuery(''); }}
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none cursor-pointer text-sm text-content dark:text-content-dark font-cairo hover:bg-gray-100 dark:hover:bg-brand-500/10 transition-colors"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: avatarColor(c.id) }}
                >
                  {initials(c.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.full_name}</div>
                  <div className="text-xs text-content-muted dark:text-content-muted-dark" dir="ltr">
                    {c.phone || c.email || ''}
                  </div>
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
function AddModal({ isRTL, lang, onClose, onSave, agents, projects }) {
  const [form, setForm] = useState({ contact: null, budget: '', assigned_to: '', temperature: 'hot', priority: 'medium', stage: 'new', project_id: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const contactDept = form.contact?.department || 'sales';
  const stageConfig = getDeptStages(contactDept);

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
    // Inject joined data so cards render names immediately
    if (!result.contacts && form.contact) {
      result.contacts = { id: form.contact.id, full_name: form.contact.full_name, phone: form.contact.phone, email: form.contact.email, company: form.contact.company, contact_type: form.contact.contact_type, department: form.contact.department };
    }
    if (!result.projects && form.project_id) {
      const proj = projects.find(p => p.id === form.project_id);
      if (proj) result.projects = { id: proj.id, name_ar: proj.name_ar, name_en: proj.name_en };
    }
    if (!result.users && form.assigned_to) {
      const agent = agents.find(a => a.id === form.assigned_to);
      if (agent) result.users = { id: agent.id, full_name_ar: agent.full_name_ar, full_name_en: agent.full_name_en };
    }
    onSave(result);
    setSaving(false);
  };

  return (
    <Modal open={true} onClose={onClose} title={isRTL ? 'إضافة فرصة جديدة' : 'Add New Opportunity'} width="max-w-lg">
      <div className="grid grid-cols-2 gap-3.5 modal-grid">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'جهة الاتصال *' : 'Contact *'}
          </label>
          <ContactSearch isRTL={isRTL} value={form.contact} onSelect={c => { f('contact', c); if (c) { const stages = getDeptStages(c.department || 'sales'); f('stage', stages[0]?.id || 'new'); } }} />
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الميزانية' : 'Budget'}
          </label>
          <Input type="number" value={form.budget} onChange={e => f('budget', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المسؤول' : 'Agent'}
          </label>
          <Select value={form.assigned_to} onChange={e => f('assigned_to', e.target.value)}>
            <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
            {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المشروع' : 'Project'}
          </label>
          <Select value={form.project_id} onChange={e => f('project_id', e.target.value)}>
            <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'المرحلة' : 'Stage'}
          </label>
          <Select value={form.stage} onChange={e => f('stage', e.target.value)}>
            {stageConfig.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
          </Select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الحرارة' : 'Temperature'}
          </label>
          <div className="flex gap-1.5">
            {Object.entries(TEMP_CONFIG).map(([k, v]) => {
              const isActive = form.temperature === k;
              return (
                <button
                  key={k}
                  onClick={() => f('temperature', k)}
                  className={`flex-1 py-[7px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${
                    isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'
                  }`}
                  style={isActive ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                >
                  {isRTL ? v.label_ar : v.label_en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الأولوية' : 'Priority'}
          </label>
          <div className="flex gap-1.5">
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
              const isActive = form.priority === k;
              return (
                <button
                  key={k}
                  onClick={() => f('priority', k)}
                  className={`flex-1 py-[7px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${
                    isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'
                  }`}
                  style={isActive ? { borderColor: v.color, background: `${v.color}18`, color: v.color } : {}}
                >
                  {isRTL ? v.label_ar : v.label_en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'ملاحظات' : 'Notes'}
          </label>
          <Textarea value={form.notes} onChange={e => f('notes', e.target.value)} />
        </div>
      </div>
      <ModalFooter>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!form.contact || saving}
          className="gap-1.5"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
        <Button variant="secondary" size="md" onClick={onClose}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
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
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [opps, setOpps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterTemp, setFilterTemp] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingOpp, setEditingOpp] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterDate, setFilterDate] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [drawerActivities, setDrawerActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // ESC to close drawer
  useEffect(() => {
    if (!selectedOpp) return;
    const handler = (e) => { if (e.key === 'Escape') { setSelectedOpp(null); setEditingOpp(false); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedOpp]);

  // Fetch activities for drawer
  useEffect(() => {
    if (!selectedOpp?.contact_id) { setDrawerActivities([]); return; }
    let cancelled = false;
    setLoadingActivities(true);
    fetchContactActivities(selectedOpp.contact_id)
      .then(data => { if (!cancelled) setDrawerActivities(data?.slice(0, 5) || []); })
      .catch(() => { if (!cancelled) setDrawerActivities([]); })
      .finally(() => { if (!cancelled) setLoadingActivities(false); });
    return () => { cancelled = true; };
  }, [selectedOpp?.contact_id]);

  // Dynamic stage config based on department filter
  const currentStages = filterDept === 'all' ? getDeptStages('sales') : getDeptStages(filterDept);
  const stageConfigWithAll = [{ id: 'all', label_ar: 'الكل', label_en: 'All', color: '#4A7AAB' }, ...currentStages];

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [oppsData, agentsData, projectsData] = await Promise.all([
        fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
        fetchSalesAgents(),
        fetchProjects(),
      ]);
      // Client-side enrich: attach agent/project names from fetched lists if missing
      const agentMap = {};
      agentsData.forEach(a => { agentMap[a.id] = a; });
      const projMap = {};
      projectsData.forEach(p => { projMap[p.id] = p; });
      // Also try localStorage contacts
      let localContacts = [];
      try { localContacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]'); } catch {}
      const contactMap = {};
      localContacts.forEach(c => { contactMap[c.id] = c; });

      const enriched = oppsData.map(o => ({
        ...o,
        contacts: o.contacts || contactMap[o.contact_id] || null,
        users: o.users || agentMap[o.assigned_to] || null,
        projects: o.projects || projMap[o.project_id] || null,
      }));
      setOpps(enriched);
      setAgents(agentsData);
      setProjects(projectsData);
      setLoading(false);
    };
    load();
  }, [profile?.role, profile?.id, profile?.team_id]);

  const filtered = opps.filter(o => {
    if (filterDept !== 'all' && (o.contacts?.department || 'sales') !== filterDept) return false;
    if (activeStage !== 'all' && o.stage !== activeStage) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = getContactName(o).toLowerCase();
      const project = getProjectName(o, lang).toLowerCase();
      if (!name.includes(q) && !project.includes(q)) return false;
    }
    if (filterAgent !== 'all' && o.assigned_to !== filterAgent) return false;
    if (filterTemp !== 'all' && o.temperature !== filterTemp) return false;
    if (filterDate !== 'all' && o.created_at) {
      const now = new Date();
      let start;
      if (filterDate === 'this_week') { start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0); }
      else if (filterDate === 'this_month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
      else if (filterDate === 'last_30') { start = new Date(now); start.setDate(now.getDate() - 30); }
      if (start && new Date(o.created_at) < start) return false;
    }
    return true;
  });

  // Export data
  const exportData = filtered.map(o => ({
    [isRTL ? 'الاسم' : 'Name']: getContactName(o),
    [isRTL ? 'الهاتف' : 'Phone']: o.contacts?.phone || '',
    [isRTL ? 'المشروع' : 'Project']: getProjectName(o, lang),
    [isRTL ? 'الميزانية' : 'Budget']: o.budget || 0,
    [isRTL ? 'المرحلة' : 'Stage']: deptStageLabel(o.stage, o.contacts?.department || 'sales', isRTL),
    [isRTL ? 'الحرارة' : 'Temp']: isRTL ? (TEMP_CONFIG[o.temperature]?.label_ar || '') : (TEMP_CONFIG[o.temperature]?.label_en || ''),
    [isRTL ? 'المسؤول' : 'Agent']: getAgentName(o, lang),
    [isRTL ? 'التاريخ' : 'Date']: o.created_at?.slice(0, 10) || '',
  }));

  const totalBudget = filtered.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = filtered.filter(o => o.stage === 'closed_won').length;
  const hotCount = filtered.filter(o => o.temperature === 'hot').length;

  const handleMove = async (id, toStage) => {
    setOpps(p => p.map(o => o.id === id ? { ...o, stage: toStage } : o));
    if (selectedOpp?.id === id) setSelectedOpp(p => ({ ...p, stage: toStage }));
    await updateOpportunity(id, { stage: toStage }).catch(() => {});

    // Auto-create deal in Operations when closed_won (sales only)
    if (toStage === 'closed_won') {
      const opp = opps.find(o => o.id === id);
      if (opp && (opp.contacts?.department || 'sales') === 'sales') {
        const deal = createDealFromOpportunity({ ...opp, stage: toStage });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteOpp = async () => {
    if (!confirmDelete) return;
    setOpps(p => p.filter(o => o.id !== confirmDelete));
    if (selectedOpp?.id === confirmDelete) setSelectedOpp(null);
    await deleteOpportunity(confirmDelete).catch(() => {});
    setConfirmDelete(null);
  };

  const handleSave = (opp) => {
    setOpps(p => [opp, ...p]);
    setShowModal(false);
  };

  const startEdit = () => {
    setEditForm({
      budget: selectedOpp.budget || '',
      temperature: selectedOpp.temperature || 'cold',
      priority: selectedOpp.priority || 'medium',
      assigned_to: selectedOpp.assigned_to || '',
      project_id: selectedOpp.project_id || '',
      notes: selectedOpp.notes || '',
    });
    setEditingOpp(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    const updates = {
      budget: Number(editForm.budget) || 0,
      temperature: editForm.temperature,
      priority: editForm.priority,
      assigned_to: editForm.assigned_to || null,
      project_id: editForm.project_id || null,
      notes: editForm.notes,
    };
    const result = await updateOpportunity(selectedOpp.id, updates);
    setOpps(p => p.map(o => o.id === selectedOpp.id ? { ...o, ...result } : o));
    setSelectedOpp(prev => ({ ...prev, ...result }));
    setEditingOpp(false);
    setEditSaving(false);
  };

  if (loading) return <PageSkeleton hasKpis kpiCount={4} tableRows={6} tableCols={5} />;

  return (<>
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark font-cairo px-4 py-4 md:px-7 md:py-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
              <Grid3X3 size={20} className="text-brand-500" />
            </div>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'الفرص' : 'Opportunities'}
            </h1>
          </div>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'إدارة وتتبع الفرص لكل الأقسام' : 'Manage and track opportunities across departments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton data={exportData} filename="opportunities" title={isRTL ? 'الفرص' : 'Opportunities'} />
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} />{isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: isRTL ? 'إجمالي الفرص' : 'Total', value: filtered.length, color: '#4A7AAB', icon: Grid3X3 },
          { label: isRTL ? 'إجمالي الميزانيات' : 'Budget', value: fmtBudget(totalBudget) + (isRTL ? ' ج' : ' EGP'), color: '#4A7AAB', icon: Banknote },
          { label: isRTL ? 'صفقات مغلقة' : 'Won', value: wonCount, color: '#10B981', icon: Building2 },
          { label: isRTL ? 'فرص ساخنة' : 'Hot', value: hotCount, color: '#EF4444', icon: Flame },
        ].map((s, i) => (
          <div key={i} className="flex-[1_1_140px]">
            <KpiCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
          </div>
        ))}
      </div>

      {/* Stage Tabs */}
      <Card className="p-2.5 px-3.5 mb-4 flex gap-1.5 flex-wrap">
        {stageConfigWithAll.map(s => {
          const preFiltered = opps.filter(o => {
            if (filterDept !== 'all' && (o.contacts?.department || 'sales') !== filterDept) return false;
            if (search) { const q = search.toLowerCase(); const n = getContactName(o).toLowerCase(); const p = getProjectName(o, lang).toLowerCase(); if (!n.includes(q) && !p.includes(q)) return false; }
            if (filterAgent !== 'all' && o.assigned_to !== filterAgent) return false;
            if (filterTemp !== 'all' && o.temperature !== filterTemp) return false;
            return true;
          });
          const count = s.id === 'all' ? preFiltered.length : preFiltered.filter(o => o.stage === s.id).length;
          const active = activeStage === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStage(s.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-none cursor-pointer font-cairo text-xs whitespace-nowrap transition-all duration-150 ${
                active ? 'font-bold text-white' : 'font-medium text-content-muted dark:text-content-muted-dark bg-transparent'
              }`}
              style={active ? { background: s.color } : {}}
            >
              {isRTL ? s.label_ar : s.label_en}
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-px ${
                  active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-brand-500/15 text-content-muted dark:text-content-muted-dark'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </Card>

      {/* Filters */}
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        <div className="relative flex-[1_1_180px] max-w-[320px]">
          <Search
            size={14}
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-content-muted dark:text-content-muted-dark start-2.5"
          />
          <Input
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-8"
          />
        </div>
        <Select className="!w-auto flex-none min-w-[120px]" value={filterDept} onChange={e => { setFilterDept(e.target.value); setActiveStage('all'); }}>
          {Object.entries(DEPT_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
        </Select>
        <Select className="!w-auto flex-none min-w-[120px]" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="all">{isRTL ? 'كل المسؤولين' : 'All Agents'}</option>
          {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
        </Select>
        <Select className="!w-auto flex-none min-w-[100px]" value={filterTemp} onChange={e => setFilterTemp(e.target.value)}>
          <option value="all">{isRTL ? 'كل الحرارة' : 'All Temps'}</option>
          {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.label_ar : v.label_en}</option>)}
        </Select>
        <Select className="!w-auto flex-none min-w-[110px]" value={filterDate} onChange={e => setFilterDate(e.target.value)}>
          {Object.entries(DATE_FILTERS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
        </Select>
        {(search || filterAgent !== 'all' || filterTemp !== 'all' || filterDept !== 'all' || filterDate !== 'all') && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => { setSearch(''); setFilterAgent('all'); setFilterTemp('all'); setFilterDept('all'); setFilterDate('all'); setActiveStage('all'); }}
          >
            <X size={14} /> {isRTL ? 'مسح' : 'Clear'}
          </Button>
        )}
        <div className="ms-auto flex items-center gap-2.5">
          <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => { setViewMode('kanban'); setActiveStage('all'); }} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'kanban' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><Columns size={14} /></button>
          </div>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">{filtered.length} {isRTL ? 'فرصة' : 'opps'}</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 h-[180px]">
              <div className="flex gap-2.5 mb-3">
                <div className="w-[38px] h-[38px] rounded-full bg-gray-100 dark:bg-white/5 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3.5 rounded-md w-[70%] mb-1.5 bg-gray-100 dark:bg-white/5 animate-pulse" />
                  <div className="h-2.5 rounded-md w-[40%] bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
              <div className="h-3 rounded-md w-1/2 mb-2.5 bg-gray-100 dark:bg-white/5" />
              <div className="flex gap-1.5">
                {[1, 2, 3].map(j => <div key={j} className="h-6 rounded-md flex-1 bg-gray-100 dark:bg-white/5" />)}
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-5">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-brand-500" />
          </div>
          <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'لا توجد فرص بيع' : 'No Opportunities Found'}
          </p>
          <p className="m-0 mb-4 text-sm text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'لم يتم إضافة أي فرص بيع بعد' : 'No sales opportunities have been added yet'}
          </p>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} /> {isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
          </Button>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {currentStages.map(stage => {
            const stageOpps = filtered.filter(o => o.stage === stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-[300px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                  <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? stage.label_ar : stage.label_en}</span>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark bg-gray-100 dark:bg-brand-500/15 rounded-full px-1.5 py-px">{stageOpps.length}</span>
                </div>
                <div className="flex flex-col gap-3 min-h-[200px] bg-brand-500/[0.03] dark:bg-brand-500/[0.04] rounded-xl p-2.5 border border-dashed border-edge dark:border-edge-dark">
                  {stageOpps.length === 0 ? (
                    <div className="text-center py-8 text-xs text-content-muted dark:text-content-muted-dark opacity-50">{isRTL ? 'لا توجد فرص' : 'Empty'}</div>
                  ) : stageOpps.map(opp => (
                    <OppCard key={opp.id} opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={setSelectedOpp} stageConfig={currentStages} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filtered.map(opp => (
            <OppCard key={opp.id} opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={setSelectedOpp} stageConfig={getDeptStages(opp.contacts?.department || 'sales')} />
          ))}
        </div>
      )}

      {showModal && <AddModal isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} />}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-card dark:bg-surface-card-dark border border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">{isRTL ? 'حذف الفرصة؟' : 'Delete Opportunity?'}</h3>
            <p className="m-0 mb-5 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'هل أنت متأكد من حذف هذه الفرصة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this opportunity? This action cannot be undone.'}</p>
            <div className="flex gap-2.5 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="danger" size="sm" onClick={confirmDeleteOpp}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Deal Created Toast */}
    {dealCreatedToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'left' : 'right']: 24 }}
      >
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm">🎉</div>
        <div>
          <div>{isRTL ? 'تم إنشاء صفقة جديدة!' : 'Deal created!'}</div>
          <div className="text-xs opacity-85 mt-0.5">{dealCreatedToast} → {isRTL ? 'العمليات' : 'Operations'}</div>
        </div>
        <button
          onClick={() => setDealCreatedToast(null)}
          className="bg-transparent border-none text-white cursor-pointer opacity-70 p-0.5 ms-2 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    )}
    <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

    {/* Drawer */}
    {selectedOpp && (
      <div
        role="dialog"
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed inset-0 z-[200] bg-black/40 flex ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}
        onClick={e => { if (e.target === e.currentTarget) setSelectedOpp(null); }}
      >
        <div className="w-full max-w-[460px] h-full bg-surface-card dark:bg-surface-card-dark shadow-[-8px_0_40px_rgba(0,0,0,0.2)] flex flex-col overflow-y-auto">
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-edge dark:border-edge-dark flex items-center justify-between bg-[#F8FAFC] dark:bg-surface-bg-dark">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: avatarColor(selectedOpp.contact_id || selectedOpp.id) }}
              >
                {initials(getContactName(selectedOpp))}
              </div>
              <div>
                <p className="m-0 text-base font-bold text-content dark:text-content-dark">{getContactName(selectedOpp)}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedOpp.contacts?.phone && (
                    <span className="text-xs text-content-muted dark:text-content-muted-dark" dir="ltr">{selectedOpp.contacts.phone}</span>
                  )}
                  {selectedOpp.contacts?.email && (
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{selectedOpp.contacts.email}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedOpp.contacts?.company && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500">{selectedOpp.contacts.company}</span>
                  )}
                  {selectedOpp.contacts?.department && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500">
                      {isRTL ? (DEPT_LABELS[selectedOpp.contacts.department]?.ar || selectedOpp.contacts.department) : (DEPT_LABELS[selectedOpp.contacts.department]?.en || selectedOpp.contacts.department)}
                    </span>
                  )}
                  {selectedOpp.created_at && (
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark">
                      {new Date(selectedOpp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => editingOpp ? setEditingOpp(false) : startEdit()}
                className="bg-transparent border-none cursor-pointer text-brand-500 p-1 rounded-md hover:bg-brand-500/10 transition-colors"
                title={isRTL ? 'تعديل' : 'Edit'}
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => { setSelectedOpp(null); setEditingOpp(false); }}
                className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark text-xl leading-none p-1 hover:text-content dark:hover:text-content-dark transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Details */}
          <div className="px-6 py-5 flex flex-col gap-4">
            {editingOpp ? (<>
              {/* Edit Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الميزانية' : 'Budget'}</label>
                  <Input type="number" value={editForm.budget} onChange={e => setEditForm(f => ({ ...f, budget: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المسؤول' : 'Agent'}</label>
                  <Select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المشروع' : 'Project'}</label>
                <Select value={editForm.project_id} onChange={e => setEditForm(f => ({ ...f, project_id: e.target.value }))}>
                  <option value="">{isRTL ? 'بدون مشروع' : 'No Project'}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الحرارة' : 'Temperature'}</label>
                <div className="flex gap-1.5">
                  {Object.entries(TEMP_CONFIG).map(([k, v]) => {
                    const isActive = editForm.temperature === k;
                    return (
                      <button key={k} onClick={() => setEditForm(f => ({ ...f, temperature: k }))}
                        className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                        style={isActive ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                      >{isRTL ? v.label_ar : v.label_en}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الأولوية' : 'Priority'}</label>
                <div className="flex gap-1.5">
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => {
                    const isActive = editForm.priority === k;
                    return (
                      <button key={k} onClick={() => setEditForm(f => ({ ...f, priority: k }))}
                        className={`flex-1 py-[6px] rounded-[7px] cursor-pointer text-xs font-semibold font-cairo transition-all duration-150 border-2 ${isActive ? '' : 'bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark border-transparent'}`}
                        style={isActive ? { borderColor: v.color, background: `${v.color}18`, color: v.color } : {}}
                      >{isRTL ? v.label_ar : v.label_en}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={editSaving} className="flex-1 gap-1.5">
                  {editSaving && <Loader2 size={13} className="animate-spin" />}
                  {isRTL ? 'حفظ' : 'Save'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingOpp(false)} className="flex-1">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </>) : (<>
              {/* View Mode */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: isRTL ? 'الميزانية' : 'Budget', value: fmtBudget(selectedOpp.budget) + ' ' + (isRTL ? 'ج' : 'EGP'), color: '#4A7AAB' },
                  { label: isRTL ? 'الحرارة' : 'Temperature', value: isRTL ? (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_en, color: (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).color },
                  { label: isRTL ? 'الأولوية' : 'Priority', value: isRTL ? (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_ar : (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_en, color: (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).color },
                  { label: isRTL ? 'المسؤول' : 'Agent', value: getAgentName(selectedOpp, lang), color: isDark ? '#E2EAF4' : '#1B3347' },
                ].map((item, i) => (
                  <div key={i} className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                    <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{item.label}</p>
                    <p className="m-0 text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Project */}
              {getProjectName(selectedOpp, lang) && (
                <div className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'المشروع' : 'Project'}</p>
                  <p className="m-0 text-sm font-semibold text-content dark:text-content-dark">{getProjectName(selectedOpp, lang)}</p>
                </div>
              )}

              {/* Notes */}
              {selectedOpp.notes && (
                <div className="bg-brand-500/[0.08] dark:bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'ملاحظات' : 'Notes'}</p>
                  <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed">{selectedOpp.notes}</p>
                </div>
              )}
            </>)}

            {/* Pipeline Stepper */}
            <div>
              <p className="m-0 mb-3 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'مراحل التقدم' : 'Pipeline Progress'}
              </p>
              {(() => {
                const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
                const currentIdx = stages.findIndex(st => st.id === selectedOpp.stage);
                const isLost = selectedOpp.stage === 'closed_lost';
                return (
                  <div className="flex items-start">
                    {stages.map((s, i) => {
                      const isPast = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      return (
                        <div key={s.id} className="flex items-start flex-1 min-w-0">
                          <button
                            onClick={() => handleMove(selectedOpp.id, s.id)}
                            className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none w-full group p-0"
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                isCurrent ? 'ring-2 ring-offset-1 ring-offset-surface-card dark:ring-offset-surface-card-dark' : ''
                              } ${
                                isPast || isCurrent
                                  ? isLost && isCurrent ? 'bg-red-500 text-white ring-red-500' : 'text-white'
                                  : 'bg-gray-100 dark:bg-white/10 text-content-muted dark:text-content-muted-dark group-hover:bg-brand-500/20'
                              }`}
                              style={(isPast || isCurrent) && !(isLost && isCurrent) ? { background: s.color, '--tw-ring-color': s.color } : {}}
                            >
                              {isPast ? '✓' : i + 1}
                            </div>
                            <span className={`text-[8px] text-center leading-tight max-w-full ${isCurrent ? 'font-bold text-content dark:text-content-dark' : 'text-content-muted dark:text-content-muted-dark'}`}>
                              {isRTL ? s.label_ar : s.label_en}
                            </span>
                          </button>
                          {i < stages.length - 1 && (
                            <div className={`h-[2px] flex-1 min-w-[4px] mt-[13px] -mx-0.5 ${i < currentIdx ? 'bg-brand-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Activities Timeline */}
            <div>
              <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'آخر الأنشطة' : 'Recent Activities'}
              </p>
              {loadingActivities ? (
                <div className="text-center py-4 text-xs text-content-muted dark:text-content-muted-dark"><Loader2 size={16} className="animate-spin inline-block" /></div>
              ) : drawerActivities.length === 0 ? (
                <div className="text-center py-4 text-xs text-content-muted dark:text-content-muted-dark opacity-60">
                  <Clock size={20} className="opacity-30 mb-1 mx-auto" />
                  <p className="m-0">{isRTL ? 'لا توجد أنشطة' : 'No activities'}</p>
                </div>
              ) : drawerActivities.map(act => {
                const ActIcon = ACTIVITY_ICONS[act.type] || Clock;
                return (
                  <div key={act.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-xl p-3 mb-2">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="w-[24px] h-[24px] rounded-[6px] bg-brand-500/10 flex items-center justify-center shrink-0 mt-px">
                        <ActIcon size={12} color="#4A7AAB" />
                      </div>
                      <span className="text-content dark:text-content-dark text-xs font-semibold flex-1">{act.description}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-content-muted dark:text-content-muted-dark ps-8">
                      <span>{isRTL ? (act.users?.full_name_ar || '—') : (act.users?.full_name_en || act.users?.full_name_ar || '—')}</span>
                      <span>{act.created_at?.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Follow Up Reminder */}
            <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />
          </div>
        </div>
        <div className="flex-1" onClick={() => setSelectedOpp(null)} />
      </div>
    )}
  </>);
}
