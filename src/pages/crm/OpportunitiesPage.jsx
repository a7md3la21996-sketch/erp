import { useState, useRef, useEffect, useCallback } from "react";
import FollowUpReminder from '../../components/ui/FollowUpReminder';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects, searchContacts } from '../../services/opportunitiesService';
import { createDealFromOpportunity } from '../../services/dealsService';
import { TrendingUp, Plus, Search, X, MoreHorizontal, Trash2, Building2, Banknote, User, Grid3X3, Flame, Loader2, Pencil } from 'lucide-react';
import { Button, Card, Input, Select, Textarea, Modal, ModalFooter, KpiCard, PageSkeleton } from '../../components/ui';
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
  const [filterDept, setFilterDept] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingOpp, setEditingOpp] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);

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
      setOpps(oppsData);
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
    return true;
  });

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

  const handleDelete = async (id) => {
    setOpps(p => p.filter(o => o.id !== id));
    if (selectedOpp?.id === id) setSelectedOpp(null);
    await deleteOpportunity(id).catch(() => {});
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
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus size={15} />{isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
        </Button>
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
          const deptFiltered = filterDept === 'all' ? opps : opps.filter(o => (o.contacts?.department || 'sales') === filterDept);
          const count = s.id === 'all' ? deptFiltered.length : deptFiltered.filter(o => o.stage === s.id).length;
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
        <div className="relative flex-[1_1_200px]">
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
        <Select className="w-auto flex-none" value={filterDept} onChange={e => { setFilterDept(e.target.value); setActiveStage('all'); }}>
          {Object.entries(DEPT_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
        </Select>
        <Select className="w-auto flex-none" value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="all">{isRTL ? 'كل المسؤولين' : 'All Agents'}</option>
          {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
        </Select>
        <Select className="w-auto flex-none" value={filterTemp} onChange={e => setFilterTemp(e.target.value)}>
          <option value="all">{isRTL ? 'كل الحرارة' : 'All Temps'}</option>
          {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.label_ar : v.label_en}</option>)}
        </Select>
        {(search || filterAgent !== 'all' || filterTemp !== 'all' || filterDept !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterAgent('all'); setFilterTemp('all'); setFilterDept('all'); setActiveStage('all'); }}
            className="p-2 rounded-lg border-none cursor-pointer bg-red-500/10 text-red-500 flex hover:bg-red-500/20 transition-colors"
          >
            <X size={14} />
          </button>
        )}
        <div className="ms-auto text-xs text-content-muted dark:text-content-muted-dark">
          {filtered.length} {isRTL ? 'فرصة' : 'opportunities'}
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
          <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'لم يتم إضافة أي فرص بيع بعد' : 'No sales opportunities have been added yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filtered.map(opp => (
            <OppCard key={opp.id} opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={setSelectedOpp} stageConfig={getDeptStages(opp.contacts?.department || 'sales')} />
          ))}
        </div>
      )}

      {showModal && <AddModal isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} />}
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
        className={`fixed inset-0 z-[200] flex ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}
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

            {/* Change Stage */}
            <div>
              <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'تغيير المرحلة' : 'Change Stage'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {getDeptStages(selectedOpp.contacts?.department || 'sales').map(s => {
                  const isActive = s.id === selectedOpp.stage;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleMove(selectedOpp.id, s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer font-cairo transition-all duration-150 border ${
                        isActive ? 'font-bold' : 'font-normal bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:bg-gray-50 dark:hover:bg-brand-500/10'
                      }`}
                      style={isActive ? { borderColor: s.color, background: `${s.color}18`, color: s.color } : {}}
                    >
                      {isRTL ? s.label_ar : s.label_en}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow Up Reminder */}
            <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />
          </div>
        </div>
        <div className="flex-1 bg-black/40" onClick={() => setSelectedOpp(null)} />
      </div>
    )}
  </>);
}
