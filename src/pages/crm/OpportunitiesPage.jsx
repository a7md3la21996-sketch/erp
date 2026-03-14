import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import FollowUpReminder from '../../components/ui/FollowUpReminder';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, fetchSalesAgents, fetchProjects, searchContacts } from '../../services/opportunitiesService';
import { fetchContactActivities, createActivity } from '../../services/contactsService';
import { createDealFromOpportunity, dealExistsForOpportunity } from '../../services/dealsService';
import { useNavigate } from 'react-router-dom';
import { useSystemConfig } from '../../contexts/SystemConfigContext';
import { TrendingUp, Plus, Search, X, MoreHorizontal, Trash2, Building2, Banknote, User, Grid3X3, Flame, Loader2, Pencil, Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star, LayoutGrid, Columns, MapPin, Briefcase, Calendar, ExternalLink, CheckSquare, AlertTriangle, Timer, Bookmark, StickyNote, Zap, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Button, Card, Input, Select, Textarea, Modal, ModalFooter, KpiCard, PageSkeleton, ExportButton, SmartFilter, applySmartFilters } from '../../components/ui';
import { DEPT_STAGES, getDeptStages, deptStageLabel } from './contacts/constants';
import { logView } from '../../services/viewTrackingService';

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

const SOURCE_LABELS = {
  facebook: { ar: 'فيسبوك', en: 'Facebook' }, google: { ar: 'جوجل', en: 'Google' },
  referral: { ar: 'توصية', en: 'Referral' }, walk_in: { ar: 'زيارة مباشرة', en: 'Walk-in' },
  phone: { ar: 'اتصال', en: 'Phone' }, website: { ar: 'الموقع', en: 'Website' },
  instagram: { ar: 'انستجرام', en: 'Instagram' }, tiktok: { ar: 'تيك توك', en: 'TikTok' },
  other: { ar: 'أخرى', en: 'Other' },
};
const CONTACT_TYPE_LABELS = {
  lead: { ar: 'عميل محتمل', en: 'Lead' }, cold: { ar: 'بارد', en: 'Cold' },
  client: { ar: 'عميل', en: 'Client' }, supplier: { ar: 'مورد', en: 'Supplier' },
  developer: { ar: 'مطور', en: 'Developer' }, applicant: { ar: 'متقدم', en: 'Applicant' },
  partner: { ar: 'شريك', en: 'Partner' },
};

const SORT_OPTIONS = {
  newest: { ar: 'الأحدث', en: 'Newest' },
  oldest: { ar: 'الأقدم', en: 'Oldest' },
  budget_high: { ar: 'الميزانية (الأعلى)', en: 'Budget (High)' },
  budget_low: { ar: 'الميزانية (الأقل)', en: 'Budget (Low)' },
  temp_hot: { ar: 'الأسخن', en: 'Hottest' },
  lead_score: { ar: 'درجة العميل', en: 'Lead Score' },
  stale: { ar: 'بدون تواصل', en: 'Stale (No Contact)' },
};

// LOST_REASONS now loaded from SystemConfigContext (lostReasons array)
const TEMP_ORDER = { hot: 0, warm: 1, cool: 2, cold: 3 };

// ─── Stage Win Rates for Weighted Pipeline Forecast ───
const STAGE_WIN_RATES = {
  new: 0.05, lead: 0.10, contacted: 0.20, qualified: 0.30, interested: 0.40,
  site_visit: 0.50, negotiation: 0.60, proposal: 0.70, closed_won: 1.0, closed_lost: 0,
  screening: 0.15, interview: 0.35, offer: 0.65, hired: 1.0, rejected: 0,
  awareness: 0.10, engagement: 0.25, conversion: 0.50, retention: 0.75,
  planning: 0.15, execution: 0.40, review: 0.60, completed: 1.0, cancelled: 0,
  budgeting: 0.15, approval: 0.40, processing: 0.60, paid: 1.0,
};

// ─── Lead Score calculation ───
const calcLeadScore = (opp) => {
  let score = 0;
  // Temperature (0-30)
  if (opp.temperature === 'hot') score += 30;
  else if (opp.temperature === 'warm') score += 20;
  else if (opp.temperature === 'cool') score += 10;
  // Budget (0-25)
  const b = opp.budget || 0;
  if (b >= 1000000) score += 25;
  else if (b >= 500000) score += 20;
  else if (b >= 100000) score += 15;
  else if (b > 0) score += 5;
  // Stage progression (0-25)
  const stagePoints = { qualification: 5, site_visit_scheduled: 10, site_visited: 13, proposal: 16, negotiation: 19, reserved: 21, contracted: 23, closed_won: 25 };
  score += stagePoints[opp.stage] || 0;
  // Recency (0-20)
  const days = Math.floor((Date.now() - new Date(opp.updated_at || opp.created_at || 0).getTime()) / 86400000);
  if (days <= 1) score += 20;
  else if (days <= 3) score += 15;
  else if (days <= 7) score += 10;
  else if (days <= 14) score += 5;
  return Math.min(score, 100);
};
const scoreColor = (s) => s >= 70 ? '#10B981' : s >= 40 ? '#F59E0B' : '#EF4444';
const scoreLabel = (s, isRTL) => s >= 70 ? (isRTL ? 'ساخن' : 'Hot') : s >= 40 ? (isRTL ? 'دافئ' : 'Warm') : (isRTL ? 'بارد' : 'Cold');

// ─── Saved Filters (localStorage) ───
const SAVED_FILTERS_KEY = 'platform_opp_saved_filters';
const getSavedFilters = () => { try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]'); } catch { return []; } };
const saveSavedFilters = (f) => { try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(f)); } catch {} };

// ─── Stage History (localStorage) ───
const STAGE_HISTORY_KEY = 'platform_opp_stage_history';
const getStageHistory = (oppId) => { try { const all = JSON.parse(localStorage.getItem(STAGE_HISTORY_KEY) || '{}'); return all[oppId] || []; } catch { return []; } };
const addStageHistory = (oppId, fromStage, toStage) => {
  try {
    const all = JSON.parse(localStorage.getItem(STAGE_HISTORY_KEY) || '{}');
    if (!all[oppId]) all[oppId] = [];
    all[oppId].push({ from: fromStage, to: toStage, at: new Date().toISOString() });
    localStorage.setItem(STAGE_HISTORY_KEY, JSON.stringify(all));
  } catch {}
};

// ─── Notes (localStorage) ───
const NOTES_KEY = 'platform_opp_notes';
const getOppNotes = (oppId) => { try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); return all[oppId] || []; } catch { return []; } };
const addOppNote = (oppId, text) => {
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (!all[oppId]) all[oppId] = [];
    const note = { id: Date.now().toString(), text, at: new Date().toISOString() };
    all[oppId].unshift(note);
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
    return note;
  } catch { return { id: Date.now().toString(), text, at: new Date().toISOString() }; }
};
const deleteOppNote = (oppId, noteId) => {
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (all[oppId]) all[oppId] = all[oppId].filter(n => n.id !== noteId);
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch {}
};

const fmtBudget = (n) => { if (!n) return "-"; if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(0) + "K"; return n.toLocaleString(); };
const daysSince = (date) => date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : 999;
const daysInStage = (opp) => daysSince(opp.stage_changed_at || opp.updated_at || opp.created_at);
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
function OppCard({ opp, isRTL, lang, onDelete, onMove, onSelect, stageConfig, score: preScore, isAdmin }) {
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
                {stageConfig.filter(s => {
                  if (s.id === opp.stage) return false;
                  if (isAdmin) return true;
                  const currentIdx = stageConfig.findIndex(st => st.id === opp.stage);
                  const targetIdx = stageConfig.findIndex(st => st.id === s.id);
                  return targetIdx > currentIdx;
                }).slice(0, 5).map(s => (
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

      {/* Tags: Budget + Temp + Priority + Score */}
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
        {(() => {
          const score = preScore ?? calcLeadScore(opp);
          return (
            <div className="rounded-md px-2 py-1 text-[10px] font-bold flex items-center gap-0.5" style={{ background: `${scoreColor(score)}18`, color: scoreColor(score) }}>
              <Zap size={9} />{score}
            </div>
          );
        })()}
      </div>

      {/* Source badge */}
      {(opp.contacts?.source || opp.source) && (() => {
        const src = opp.contacts?.source || opp.source;
        const srcLabel = SOURCE_LABELS[src];
        return srcLabel ? (
          <div className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark">
            <ExternalLink size={9} className="shrink-0" />
            <span>{isRTL ? srcLabel.ar : srcLabel.en}</span>
          </div>
        ) : null;
      })()}

      {/* Stale deal alert */}
      {(() => {
        const lastAct = opp.contacts?.last_activity_at || opp.updated_at || opp.created_at;
        const days = daysSince(lastAct);
        if (days < 7 || opp.stage === 'closed_won' || opp.stage === 'closed_lost') return null;
        return (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md ${days >= 14 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <AlertTriangle size={9} />
            {days >= 14
              ? (isRTL ? `⚠ بدون تواصل ${days} يوم` : `⚠ ${days}d no contact`)
              : (isRTL ? `${days} يوم بدون نشاط` : `${days}d inactive`)}
          </div>
        );
      })()}

      {/* Expected close date warning */}
      {opp.expected_close_date && (() => {
        const diff = Math.ceil((new Date(opp.expected_close_date) - Date.now()) / 86400000);
        if (diff > 7) return null;
        return (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md ${diff < 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <Calendar size={9} />
            {diff < 0 ? (isRTL ? `متأخر ${Math.abs(diff)} يوم` : `${Math.abs(diff)}d overdue`) : diff === 0 ? (isRTL ? 'اليوم' : 'Due today') : (isRTL ? `${diff} يوم متبقي` : `${diff}d left`)}
          </div>
        );
      })()}

      {/* Footer: Agent + Last Activity + Days in stage */}
      <div className="flex items-center justify-between pt-2 border-t border-edge dark:border-edge-dark">
        <div className="flex items-center gap-1.5 text-xs text-content-muted dark:text-content-muted-dark truncate">
          <User size={11} className="shrink-0" /><span className="truncate">{agentName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            const days = daysInStage(opp);
            return days > 0 && (
              <span className={`text-[10px] px-1.5 py-px rounded-full ${days > 7 ? 'bg-red-500/10 text-red-500' : days > 3 ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-100 dark:bg-white/10 text-content-muted dark:text-content-muted-dark'}`}>
                <Timer size={8} className="inline -mt-px" /> {days}{isRTL ? 'ي' : 'd'}
              </span>
            );
          })()}
          <div className="text-xs font-bold" style={{ color: act.color }}>{act.text}</div>
        </div>
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
function AddModal({ isRTL, lang, onClose, onSave, agents, projects, existingOpps = [], currentUserId }) {
  const [form, setForm] = useState({ contact: null, budget: '', assigned_to: '', temperature: 'hot', priority: 'medium', stage: 'qualification', project_id: '', notes: '', expected_close_date: '' });
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
      assigned_by: currentUserId || null,
      temperature: form.temperature,
      priority: form.priority,
      stage: form.stage,
      project_id: form.project_id || null,
      notes: form.notes,
      expected_close_date: form.expected_close_date || null,
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
          <ContactSearch isRTL={isRTL} value={form.contact} onSelect={c => { f('contact', c); if (c) { const stages = getDeptStages(c.department || 'sales'); f('stage', stages[0]?.id || 'qualification'); } }} />
          {form.contact && existingOpps.some(o => o.contact_id === form.contact.id) && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
              <AlertTriangle size={12} />
              {isRTL ? 'تنبيه: يوجد فرصة أخرى لنفس العميل' : 'Warning: This contact already has an opportunity'}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'الميزانية' : 'Budget'}
          </label>
          <Input type="number" min="0" value={form.budget} onChange={e => f('budget', Math.max(0, e.target.value))} />
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
        <div>
          <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'تاريخ الإغلاق المتوقع' : 'Expected Close'}
          </label>
          <Input type="date" value={form.expected_close_date} onChange={e => f('expected_close_date', e.target.value)} />
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
  const navigate = useNavigate();
  const { lostReasons: configLostReasons } = useSystemConfig();
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [opps, setOpps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [smartFilters, setSmartFilters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [editingOpp, setEditingOpp] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [dealCreatedToast, setDealCreatedToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [drawerActivities, setDrawerActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', description: '' });
  const [savedFilters, setSavedFilters] = useState(() => getSavedFilters());
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [draggingOpp, setDraggingOpp] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [drawerNotes, setDrawerNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [stageHistory, setStageHistory] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [lostReasonModal, setLostReasonModal] = useState(null); // { id, toStage }
  const [lostReason, setLostReason] = useState('');
  const [lostReasonCustom, setLostReasonCustom] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [bulkToast, setBulkToast] = useState(null);
  const [moveWarningToast, setMoveWarningToast] = useState(null);
  const isAdmin = profile?.role === 'admin';
  const [gridPage, setGridPage] = useState(1);
  const GRID_PAGE_SIZE = 30;
  const savedFilterRef = useRef(null);

  // Click-outside for saved filters dropdown
  useEffect(() => {
    if (!showSaveFilter) return;
    const h = (e) => { if (savedFilterRef.current && !savedFilterRef.current.contains(e.target)) setShowSaveFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSaveFilter]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── SmartFilter field definitions ───
  const SMART_FIELDS = useMemo(() => [
    { id: 'department', label: 'القسم', labelEn: 'Department', type: 'select',
      options: Object.entries(DEPT_LABELS).filter(([k]) => k !== 'all').map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'assigned_to', label: 'المسؤول', labelEn: 'Agent', type: 'select',
      options: agents.map(a => ({ value: a.id, label: a.full_name_ar || a.full_name_en, labelEn: a.full_name_en || a.full_name_ar })) },
    { id: 'temperature', label: 'الحرارة', labelEn: 'Temperature', type: 'select',
      options: Object.entries(TEMP_CONFIG).map(([k, v]) => ({ value: k, label: v.label_ar, labelEn: v.label_en })) },
    { id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select',
      options: Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label_ar, labelEn: v.label_en })) },
    { id: 'source', label: 'المصدر', labelEn: 'Source', type: 'select',
      options: Object.entries(SOURCE_LABELS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })) },
    { id: 'lead_score', label: 'درجة العميل', labelEn: 'Lead Score', type: 'select',
      options: [
        { value: 'hot', label: 'ساخن (70+)', labelEn: 'Hot (70+)' },
        { value: 'warm', label: 'دافئ (40-69)', labelEn: 'Warm (40-69)' },
        { value: 'cold', label: 'بارد (<40)', labelEn: 'Cold (<40)' },
      ] },
    { id: 'stage', label: 'المرحلة', labelEn: 'Stage', type: 'select',
      options: getDeptStages('sales').map(s => ({ value: s.id, label: s.label_ar, labelEn: s.label_en })) },
    { id: 'budget', label: 'الميزانية', labelEn: 'Budget', type: 'number' },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created Date', type: 'date' },
    { id: 'expected_close_date', label: 'تاريخ الإغلاق المتوقع', labelEn: 'Expected Close', type: 'date' },
  ], [agents]);

  const SMART_SORT_OPTIONS = useMemo(() =>
    Object.entries(SORT_OPTIONS).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
  []);

  // Derive filterDept from smartFilters for stage config
  const filterDept = useMemo(() => {
    const deptFilter = smartFilters.find(f => f.field === 'department' && f.operator === 'is');
    return deptFilter ? deptFilter.value : 'all';
  }, [smartFilters]);

  // Check if edit form has unsaved changes
  const isEditDirty = editingOpp && selectedOpp && (
    String(editForm.budget) !== String(selectedOpp.budget || '') ||
    editForm.temperature !== (selectedOpp.temperature || 'cold') ||
    editForm.priority !== (selectedOpp.priority || 'medium') ||
    editForm.assigned_to !== (selectedOpp.assigned_to || '') ||
    editForm.project_id !== (selectedOpp.project_id || '') ||
    editForm.notes !== (selectedOpp.notes || '') ||
    editForm.stage !== (selectedOpp.stage || 'qualification') ||
    editForm.expected_close_date !== (selectedOpp.expected_close_date || '')
  );

  const closeDrawer = useCallback(() => {
    if (isEditDirty) {
      if (!window.confirm(isRTL ? 'يوجد تغييرات لم يتم حفظها. هل تريد الإغلاق؟' : 'You have unsaved changes. Close anyway?')) return;
    }
    setSelectedOpp(null);
    setEditingOpp(false);
  }, [isEditDirty, isRTL]);

  // ESC to close modals/drawer (priority: lost reason > confirm delete > add modal > drawer)
  // Ctrl+N / ⌘+N to open add modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (lostReasonModal) { setLostReasonModal(null); return; }
        if (confirmDelete) { setConfirmDelete(null); return; }
        if (showModal) { setShowModal(false); return; }
        if (selectedOpp) closeDrawer();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!showModal && !selectedOpp) setShowModal(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedOpp, lostReasonModal, confirmDelete, showModal, closeDrawer]);

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

  // Load notes & stage history for drawer
  useEffect(() => {
    if (!selectedOpp?.id) { setDrawerNotes([]); setStageHistory([]); return; }
    setDrawerNotes(getOppNotes(selectedOpp.id));
    setStageHistory(getStageHistory(selectedOpp.id));
  }, [selectedOpp?.id]);

  // Dynamic stage config based on department filter
  const currentStages = filterDept === 'all' ? getDeptStages('sales') : getDeptStages(filterDept);
  const stageConfigWithAll = [{ id: 'all', label_ar: 'الكل', label_en: 'All', color: '#4A7AAB' }, ...currentStages];

  // Load data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [oppsData, agentsData, projectsData] = await Promise.all([
      fetchOpportunities({ role: profile?.role, userId: profile?.id, teamId: profile?.team_id }),
      fetchSalesAgents(),
      fetchProjects(),
    ]);
    const agentMap = {};
    agentsData.forEach(a => { agentMap[a.id] = a; });
    const projMap = {};
    projectsData.forEach(p => { projMap[p.id] = p; });
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
    setRefreshing(false);
  }, [profile?.role, profile?.id, profile?.team_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Pre-compute lead scores (memoized)
  const scoreMap = useMemo(() => {
    const m = {};
    opps.forEach(o => { m[o.id] = calcLeadScore(o); });
    return m;
  }, [opps]);

  // Normalize data for SmartFilter (flatten nested fields + computed lead_score)
  const normalizedOpps = useMemo(() => opps.map(o => ({
    ...o,
    department: o.contacts?.department || 'sales',
    source: o.contacts?.source || o.source || '',
    lead_score: (() => { const s = scoreMap[o.id] || 0; return s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold'; })(),
  })), [opps, scoreMap]);

  const filtered = useMemo(() => {
    // Apply smart filters
    let result = applySmartFilters(normalizedOpps, smartFilters, SMART_FIELDS);
    // Apply stage tab filter
    if (activeStage !== 'all') result = result.filter(o => o.stage === activeStage);
    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => {
        const name = getContactName(o).toLowerCase();
        const project = getProjectName(o, lang).toLowerCase();
        const phone = (o.contacts?.phone || '').toLowerCase();
        const email = (o.contacts?.email || '').toLowerCase();
        return name.includes(q) || project.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    return result;
  }, [normalizedOpps, smartFilters, SMART_FIELDS, activeStage, search, lang]);

  // Apply sorting
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case 'budget_high': return (b.budget || 0) - (a.budget || 0);
        case 'budget_low': return (a.budget || 0) - (b.budget || 0);
        case 'temp_hot': return (TEMP_ORDER[a.temperature] ?? 4) - (TEMP_ORDER[b.temperature] ?? 4);
        case 'lead_score': return (scoreMap[b.id] || 0) - (scoreMap[a.id] || 0);
        case 'stale': return daysSince(b.contacts?.last_activity_at || b.updated_at) - daysSince(a.contacts?.last_activity_at || a.updated_at);
        default: return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });
    return arr;
  }, [filtered, sortBy, scoreMap]);

  // Select opp with view tracking
  const selectOpp = useCallback((opp) => {
    setSelectedOpp(opp);
    if (opp) logView({ entityType: 'opportunity', entityId: opp.id, entityName: opp.project || opp.contacts?.full_name, viewer: profile });
  }, [profile]);

  // Drawer prev/next navigation
  const selectedOppIdx = selectedOpp ? sortedFiltered.findIndex(o => o.id === selectedOpp.id) : -1;
  const handleOppPrev = selectedOppIdx > 0 ? () => { selectOpp(sortedFiltered[selectedOppIdx - 1]); setEditingOpp(false); } : null;
  const handleOppNext = selectedOppIdx >= 0 && selectedOppIdx < sortedFiltered.length - 1 ? () => { selectOpp(sortedFiltered[selectedOppIdx + 1]); setEditingOpp(false); } : null;

  // Grid pagination
  const gridTotalPages = Math.max(1, Math.ceil(sortedFiltered.length / GRID_PAGE_SIZE));
  const gridSafePage = Math.min(gridPage, gridTotalPages);
  const gridPaged = viewMode === 'grid' ? sortedFiltered.slice((gridSafePage - 1) * GRID_PAGE_SIZE, gridSafePage * GRID_PAGE_SIZE) : sortedFiltered;
  useEffect(() => { setGridPage(1); }, [search, smartFilters, activeStage, sortBy]);

  // Export data
  const exportData = sortedFiltered.map(o => ({
    [isRTL ? 'الاسم' : 'Name']: getContactName(o),
    [isRTL ? 'الهاتف' : 'Phone']: o.contacts?.phone || '',
    [isRTL ? 'المشروع' : 'Project']: getProjectName(o, lang),
    [isRTL ? 'الميزانية' : 'Budget']: o.budget || 0,
    [isRTL ? 'المرحلة' : 'Stage']: deptStageLabel(o.stage, o.contacts?.department || 'sales', isRTL),
    [isRTL ? 'الحرارة' : 'Temp']: isRTL ? (TEMP_CONFIG[o.temperature]?.label_ar || '') : (TEMP_CONFIG[o.temperature]?.label_en || ''),
    [isRTL ? 'المسؤول' : 'Agent']: getAgentName(o, lang),
    [isRTL ? 'الأولوية' : 'Priority']: isRTL ? (PRIORITY_CONFIG[o.priority]?.label_ar || '') : (PRIORITY_CONFIG[o.priority]?.label_en || ''),
    [isRTL ? 'درجة العميل' : 'Lead Score']: scoreMap[o.id] ?? calcLeadScore(o),
    [isRTL ? 'المصدر' : 'Source']: (() => { const src = o.contacts?.source || o.source; return src ? (isRTL ? (SOURCE_LABELS[src]?.ar || src) : (SOURCE_LABELS[src]?.en || src)) : ''; })(),
    [isRTL ? 'سبب الخسارة' : 'Lost Reason']: o.lost_reason ? (LOST_REASONS[o.lost_reason] ? (isRTL ? LOST_REASONS[o.lost_reason].ar : LOST_REASONS[o.lost_reason].en) : o.lost_reason) : '',
    [isRTL ? 'الإغلاق المتوقع' : 'Expected Close']: o.expected_close_date || '',
    [isRTL ? 'التاريخ' : 'Date']: o.created_at?.slice(0, 10) || '',
  }));

  const totalBudget = filtered.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = filtered.filter(o => o.stage === 'closed_won').length;
  const hotCount = filtered.filter(o => o.temperature === 'hot').length;
  const newThisWeek = opps.filter(o => { const d = new Date(o.created_at); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w; }).length;
  const conversionRate = opps.length > 0 ? Math.round((opps.filter(o => o.stage === 'closed_won').length / opps.length) * 100) : 0;

  // Weighted Pipeline Forecast
  const weightedForecast = useMemo(() => {
    return filtered.reduce((sum, o) => {
      if (o.stage === 'closed_won' || o.stage === 'closed_lost') return sum;
      const rate = STAGE_WIN_RATES[o.stage] || 0.1;
      return sum + (o.budget || 0) * rate;
    }, 0);
  }, [filtered]);

  // Win/Loss Analysis
  const lostReasonCounts = useMemo(() => {
    const counts = {};
    opps.forEach(o => {
      if (o.stage === 'closed_lost' && o.lost_reason) {
        counts[o.lost_reason] = (counts[o.lost_reason] || 0) + 1;
      }
    });
    return counts;
  }, [opps]);
  const topLostReason = useMemo(() => {
    const entries = Object.entries(lostReasonCounts);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  }, [lostReasonCounts]);

  const handleMove = async (id, toStage, extraUpdates = {}) => {
    // Prevent non-admin users from moving backwards in the pipeline
    if (!isAdmin) {
      const opp = opps.find(o => o.id === id);
      if (opp) {
        const dept = opp.contacts?.department || 'sales';
        const stages = getDeptStages(dept);
        const fromIdx = stages.findIndex(s => s.id === opp.stage);
        const toIdx = stages.findIndex(s => s.id === toStage);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
          setMoveWarningToast(isRTL ? 'لا يمكن نقل الفرصة لمرحلة سابقة' : 'Cannot move opportunity to a previous stage');
          setTimeout(() => setMoveWarningToast(null), 3500);
          return;
        }
      }
    }

    // Intercept closed_lost to ask for reason
    if (toStage === 'closed_lost' && !extraUpdates.lost_reason) {
      setLostReasonModal({ id, toStage });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }

    const fromStage = opps.find(o => o.id === id)?.stage;
    if (fromStage && fromStage !== toStage) addStageHistory(id, fromStage, toStage);
    setOpps(p => p.map(o => o.id === id ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates } : o));
    if (selectedOpp?.id === id) {
      setSelectedOpp(p => ({ ...p, stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates }));
      setStageHistory(getStageHistory(id));
    }
    await updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString(), ...extraUpdates }).catch(() => {});

    // Auto-create deal in Operations when closed_won (sales only)
    if (toStage === 'closed_won') {
      const opp = opps.find(o => o.id === id);
      if (opp && (opp.contacts?.department || 'sales') === 'sales' && !dealExistsForOpportunity(opp.id)) {
        const deal = await createDealFromOpportunity({ ...opp, stage: toStage });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  const confirmLostReason = async () => {
    if (!lostReasonModal) return;
    const reason = lostReason === 'other' ? lostReasonCustom : lostReason;
    if (!reason) return;

    // Handle bulk lost
    if (lostReasonModal.bulkIds) {
      const ids = lostReasonModal.bulkIds;
      ids.forEach(id => { const opp = opps.find(o => o.id === id); if (opp && opp.stage !== 'closed_lost') addStageHistory(id, opp.stage, 'closed_lost'); });
      setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() } : o));
      showBulkToast(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
      setBulkSelected(new Set()); setBulkMode(false);
      setLostReasonModal(null);
      await Promise.all(ids.map(id => updateOpportunity(id, { stage: 'closed_lost', lost_reason: reason, stage_changed_at: new Date().toISOString() }).catch(() => {})));
      return;
    }

    // If triggered from edit form, complete the full edit save with lost_reason
    if (lostReasonModal.fromEdit) {
      addStageHistory(selectedOpp.id, selectedOpp.stage, 'closed_lost');
      const updates = {
        budget: Number(editForm.budget) || 0,
        temperature: editForm.temperature,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        project_id: editForm.project_id || null,
        notes: editForm.notes,
        expected_close_date: editForm.expected_close_date || null,
        stage: 'closed_lost',
        stage_changed_at: new Date().toISOString(),
        lost_reason: reason,
      };
      setLostReasonModal(null);
      setEditSaving(true);
      const result = await updateOpportunity(selectedOpp.id, updates);
      setOpps(p => p.map(o => o.id === selectedOpp.id ? { ...o, ...result } : o));
      setSelectedOpp(prev => ({ ...prev, ...result }));
      setStageHistory(getStageHistory(selectedOpp.id));
      setEditingOpp(false);
      setEditSaving(false);
      return;
    }

    handleMove(lostReasonModal.id, lostReasonModal.toStage, { lost_reason: reason });
    setLostReasonModal(null);
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
      stage: selectedOpp.stage || 'qualification',
      expected_close_date: selectedOpp.expected_close_date || '',
    });
    setEditingOpp(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    const stageChanged = editForm.stage !== selectedOpp.stage;
    if (stageChanged) {
      // If changing to closed_lost, need reason
      if (editForm.stage === 'closed_lost') {
        setLostReasonModal({ id: selectedOpp.id, toStage: 'closed_lost', fromEdit: true });
        setLostReason('');
        setLostReasonCustom('');
        setEditSaving(false);
        return;
      }
      addStageHistory(selectedOpp.id, selectedOpp.stage, editForm.stage);
    }
    const assignmentChanged = editForm.assigned_to !== (selectedOpp.assigned_to || '');
    const updates = {
      budget: Number(editForm.budget) || 0,
      temperature: editForm.temperature,
      priority: editForm.priority,
      assigned_to: editForm.assigned_to || null,
      ...(assignmentChanged ? { assigned_by: profile?.id || null } : {}),
      project_id: editForm.project_id || null,
      notes: editForm.notes,
      expected_close_date: editForm.expected_close_date || null,
      ...(stageChanged ? { stage: editForm.stage, stage_changed_at: new Date().toISOString() } : {}),
    };
    const result = await updateOpportunity(selectedOpp.id, updates);
    setOpps(p => p.map(o => o.id === selectedOpp.id ? { ...o, ...result } : o));
    setSelectedOpp(prev => ({ ...prev, ...result }));
    if (stageChanged) setStageHistory(getStageHistory(selectedOpp.id));
    setEditingOpp(false);
    setEditSaving(false);

    // Auto-create deal if moved to closed_won
    if (stageChanged && editForm.stage === 'closed_won') {
      const opp = opps.find(o => o.id === selectedOpp.id);
      if (opp && (opp.contacts?.department || 'sales') === 'sales' && !dealExistsForOpportunity(opp.id)) {
        const deal = await createDealFromOpportunity({ ...opp, ...result });
        setDealCreatedToast(deal.deal_number);
        setTimeout(() => setDealCreatedToast(null), 4000);
      }
    }
  };

  // Bulk operations
  const toggleBulk = (id) => setBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkMoveAll = async (toStage) => {
    // Intercept closed_lost for bulk too
    if (toStage === 'closed_lost') {
      setLostReasonModal({ id: '__bulk__', toStage, bulkIds: [...bulkSelected] });
      setLostReason('');
      setLostReasonCustom('');
      return;
    }
    const ids = [...bulkSelected];
    ids.forEach(id => { const opp = opps.find(o => o.id === id); if (opp && opp.stage !== toStage) addStageHistory(id, opp.stage, toStage); });
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, stage: toStage, stage_changed_at: new Date().toISOString() } : o));
    showBulkToast(isRTL ? `تم نقل ${ids.length} فرصة` : `${ids.length} opportunities moved`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { stage: toStage, stage_changed_at: new Date().toISOString() }).catch(() => {})));
  };
  const bulkAssign = async (agentId) => {
    const ids = [...bulkSelected];
    const agent = agents.find(a => a.id === agentId);
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, assigned_to: agentId, assigned_by: profile?.id || null, users: agent || o.users } : o));
    showBulkToast(isRTL ? `تم تعيين ${ids.length} فرصة` : `${ids.length} opportunities assigned`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { assigned_to: agentId, assigned_by: profile?.id || null }).catch(() => {})));
  };
  const bulkDeleteAll = async () => {
    const ids = [...bulkSelected];
    setOpps(p => p.filter(o => !ids.includes(o.id)));
    showBulkToast(isRTL ? `تم حذف ${ids.length} فرصة` : `${ids.length} opportunities deleted`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => deleteOpportunity(id).catch(() => {})));
  };
  const bulkChangeTemp = async (temp) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, temperature: temp } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { temperature: temp }).catch(() => {})));
  };
  const bulkChangePriority = async (priority) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, priority } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { priority }).catch(() => {})));
  };
  const bulkSetCloseDate = async (date) => {
    const ids = [...bulkSelected];
    setOpps(p => p.map(o => ids.includes(o.id) ? { ...o, expected_close_date: date } : o));
    showBulkToast(isRTL ? `تم تحديث ${ids.length} فرصة` : `${ids.length} opportunities updated`);
    setBulkSelected(new Set()); setBulkMode(false);
    await Promise.all(ids.map(id => updateOpportunity(id, { expected_close_date: date || null }).catch(() => {})));
  };

  const showBulkToast = (msg) => { setBulkToast(msg); setTimeout(() => setBulkToast(null), 3000); };

  // Duplicate detection (memoized Set)
  const duplicateContactIds = useMemo(() => {
    const counts = {};
    opps.forEach(o => { if (o.contact_id) counts[o.contact_id] = (counts[o.contact_id] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [opps]);
  const isDuplicate = (contactId) => duplicateContactIds.has(String(contactId));

  // Memoize stage tab counts — uses filtered (before stage tab filter) excluding activeStage
  const stageCounts = useMemo(() => {
    // Re-apply smartFilters + search but NOT activeStage to get per-stage counts
    let base = applySmartFilters(normalizedOpps, smartFilters, SMART_FIELDS);
    if (search) {
      const q = search.toLowerCase();
      base = base.filter(o => {
        const name = getContactName(o).toLowerCase();
        const project = getProjectName(o, lang).toLowerCase();
        const phone = (o.contacts?.phone || '').toLowerCase();
        const email = (o.contacts?.email || '').toLowerCase();
        return name.includes(q) || project.includes(q) || phone.includes(q) || email.includes(q);
      });
    }
    const counts = { _total: base.length };
    base.forEach(o => { counts[o.stage] = (counts[o.stage] || 0) + 1; });
    return counts;
  }, [normalizedOpps, smartFilters, SMART_FIELDS, search, lang]);

  if (loading) return <PageSkeleton hasKpis kpiCount={6} tableRows={6} tableCols={5} />;

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
          <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing} title={isRTL ? 'تحديث' : 'Refresh'}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </Button>
          <ExportButton data={exportData} filename="opportunities" title={isRTL ? 'الفرص' : 'Opportunities'} />
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} />{isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: isRTL ? 'إجمالي الفرص' : 'Total', value: filtered.length, color: '#4A7AAB', icon: Grid3X3, onClick: () => { setSmartFilters([]); setActiveStage('all'); } },
          { label: isRTL ? 'الميزانيات' : 'Budget', value: fmtBudget(totalBudget) + (isRTL ? ' ج' : ' EGP'), color: '#4A7AAB', icon: Banknote },
          { label: isRTL ? 'صفقات مغلقة' : 'Won', value: wonCount, color: '#10B981', icon: Building2, onClick: () => setActiveStage('closed_won') },
          { label: isRTL ? 'فرص ساخنة' : 'Hot', value: hotCount, color: '#EF4444', icon: Flame, onClick: () => setSmartFilters([{ field: 'temperature', operator: 'is', value: 'hot' }]) },
          { label: isRTL ? 'التوقع المرجح' : 'Forecast', value: fmtBudget(weightedForecast) + (isRTL ? ' ج' : ' EGP'), color: '#8B5CF6', icon: TrendingUp, title: isRTL ? 'الإيراد المتوقع (الميزانية × نسبة الفوز)' : 'Weighted revenue (budget × win rate)' },
          { label: isRTL ? 'التحويل' : 'Conv.', value: conversionRate + '%', color: '#6B8DB5', icon: Zap },
          { label: isRTL ? 'جديد/أسبوع' : 'New/Wk', value: newThisWeek, color: '#0EA5E9', icon: Plus },
        ].map((s, i) => (
          <div key={i} className={`flex-[1_1_120px] ${s.onClick ? 'cursor-pointer' : ''}`} onClick={s.onClick} title={s.title || ''}>
            <KpiCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
          </div>
        ))}
      </div>

      {/* Win/Loss Analysis */}
      {Object.keys(lostReasonCounts).length > 0 && (
        <div className="mb-4 p-3 px-4 rounded-xl bg-red-500/[0.05] dark:bg-red-500/[0.08] border border-red-500/10 flex items-center gap-4 flex-wrap text-xs">
          <span className="font-bold text-red-500 flex items-center gap-1.5">
            <AlertTriangle size={13} />
            {isRTL ? 'تحليل الخسائر' : 'Loss Analysis'}
          </span>
          {Object.entries(lostReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => (
            <span key={reason} className="px-2 py-1 rounded-md bg-white dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark font-semibold">
              {LOST_REASONS[reason] ? (isRTL ? LOST_REASONS[reason].ar : LOST_REASONS[reason].en) : reason} <span className="text-red-500">({count})</span>
            </span>
          ))}
          <span className="text-content-muted dark:text-content-muted-dark ms-auto">
            {isRTL ? `الأكثر: ${topLostReason ? (LOST_REASONS[topLostReason[0]]?.ar || topLostReason[0]) : ''}` : `Top: ${topLostReason ? (LOST_REASONS[topLostReason[0]]?.en || topLostReason[0]) : ''}`}
          </span>
        </div>
      )}

      {/* Stage Tabs */}
      <Card className="p-2.5 px-3.5 mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {stageConfigWithAll.map(s => {
          const count = s.id === 'all' ? stageCounts._total : (stageCounts[s.id] || 0);
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
      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={(f) => { setSmartFilters(f); setActiveStage('all'); }}
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isRTL ? 'بحث بالاسم، المشروع، الهاتف...' : 'Search name, project, phone...'}
        sortOptions={SMART_SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={filtered.length}
        extraActions={<>
          {/* Save / Load Filters */}
          <div className="relative" ref={savedFilterRef}>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveFilter(s => !s)} title={isRTL ? 'حفظ / تحميل فلتر' : 'Save / Load Filter'}>
              <Bookmark size={14} />
            </Button>
            {showSaveFilter && (
              <div className="absolute top-full mt-1 bg-surface-card dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg z-50 p-3 w-[220px]" style={{ [isRTL ? 'right' : 'left']: 0 }}>
                <div className="flex gap-1.5 mb-2">
                  <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder={isRTL ? 'اسم الفلتر...' : 'Filter name...'} className="text-xs flex-1" />
                  <Button size="sm" onClick={() => {
                    if (!filterName.trim()) return;
                    const f = { name: filterName, search: searchInput, smartFilters, sortBy, activeStage };
                    const all = [...savedFilters, f];
                    saveSavedFilters(all); setSavedFilters(all); setFilterName('');
                  }}>{isRTL ? 'حفظ' : 'Save'}</Button>
                </div>
                {savedFilters.length > 0 && (
                  <div className="border-t border-edge dark:border-edge-dark pt-2 max-h-[150px] overflow-y-auto">
                    {savedFilters.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 px-1.5 rounded-md transition-colors">
                        <button onClick={() => {
                          setSearchInput(f.search || ''); setSearch(f.search || '');
                          setSmartFilters(f.smartFilters || []); setSortBy(f.sortBy || 'newest');
                          setActiveStage(f.activeStage || 'all'); setShowSaveFilter(false);
                        }} className="bg-transparent border-none cursor-pointer text-xs text-content dark:text-content-dark font-semibold font-cairo truncate flex-1 text-start">{f.name}</button>
                        <button onClick={() => {
                          const all = savedFilters.filter((_, j) => j !== i);
                          saveSavedFilters(all); setSavedFilters(all);
                        }} className="bg-transparent border-none cursor-pointer text-red-400 p-0.5 shrink-0"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            variant={bulkMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
            title={isRTL ? 'تحديد متعدد' : 'Bulk Select'}
          >
            <CheckSquare size={14} />
          </Button>
          <div className="flex rounded-lg border border-edge dark:border-edge-dark overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => { setViewMode('kanban'); setActiveStage('all'); }} className={`p-1.5 border-none cursor-pointer transition-colors ${viewMode === 'kanban' ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark text-content-muted dark:text-content-muted-dark'}`}><Columns size={14} /></button>
          </div>
        </>}
      />

      {/* Bulk Actions Bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/20 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
            {bulkSelected.size} {isRTL ? 'محدد' : 'selected'}
          </span>
          <Select className="!w-auto min-w-[130px] text-xs" onChange={e => { if (e.target.value) bulkMoveAll(e.target.value); e.target.value = ''; }}>
            <option value="">{isRTL ? 'نقل إلى مرحلة...' : 'Move to stage...'}</option>
            {currentStages.map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
          </Select>
          <Select className="!w-auto min-w-[130px] text-xs" onChange={e => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ''; }}>
            <option value="">{isRTL ? 'تعيين لمسؤول...' : 'Assign to agent...'}</option>
            {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
          </Select>
          <Select className="!w-auto min-w-[120px] text-xs" onChange={e => { if (e.target.value) bulkChangeTemp(e.target.value); e.target.value = ''; }}>
            <option value="">{isRTL ? 'تغيير الحرارة...' : 'Change temp...'}</option>
            {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.label_ar : v.label_en}</option>)}
          </Select>
          <Select className="!w-auto min-w-[120px] text-xs" onChange={e => { if (e.target.value) bulkChangePriority(e.target.value); e.target.value = ''; }}>
            <option value="">{isRTL ? 'تغيير الأولوية...' : 'Change priority...'}</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.label_ar : v.label_en}</option>)}
          </Select>
          <Input type="date" className="!w-auto min-w-[130px] text-xs" onChange={e => { if (e.target.value) bulkSetCloseDate(e.target.value); }} placeholder={isRTL ? 'تاريخ الإغلاق' : 'Close date'} />
          <Button variant="danger" size="sm" onClick={bulkDeleteAll}><Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}</Button>
          <Button variant="ghost" size="sm" onClick={() => setBulkSelected(new Set(sortedFiltered.map(o => o.id)))}>{isRTL ? 'تحديد الكل' : 'Select All'}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setBulkSelected(new Set()); setBulkMode(false); }}><X size={13} /></Button>
        </div>
      )}

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
            {opps.length > 0 ? <Search size={24} className="text-brand-500" /> : <TrendingUp size={24} className="text-brand-500" />}
          </div>
          <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
            {opps.length > 0
              ? (isRTL ? 'لا توجد نتائج للفلاتر الحالية' : 'No results match your filters')
              : (isRTL ? 'لا توجد فرص بيع' : 'No Opportunities Found')}
          </p>
          <p className="m-0 mb-4 text-sm text-content-muted dark:text-content-muted-dark">
            {opps.length > 0
              ? (isRTL ? 'جرب تعديل البحث أو الفلاتر' : 'Try adjusting your search or filters')
              : (isRTL ? 'لم يتم إضافة أي فرص بيع بعد' : 'No sales opportunities have been added yet')}
          </p>
          {opps.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setSmartFilters([]); setActiveStage('all'); setSortBy('newest'); }}>
              <X size={14} /> {isRTL ? 'مسح كل الفلاتر' : 'Clear All Filters'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={14} /> {isRTL ? 'إضافة فرصة' : 'Add Opportunity'}
            </Button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (<>
        <div className="flex items-center gap-3 mb-3 px-1 text-xs text-content-muted dark:text-content-muted-dark">
          <span className="font-semibold">{sortedFiltered.length} {isRTL ? 'فرصة' : 'opportunities'}</span>
          <span>•</span>
          <span className="font-bold text-brand-500">{fmtBudget(totalBudget)} {isRTL ? 'ج' : 'EGP'}</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {currentStages.map(stage => {
            const stageOpps = sortedFiltered.filter(o => o.stage === stage.id);
            const isOver = dragOverStage === stage.id;
            return (
              <div key={stage.id} className="flex-shrink-0 w-[300px]"
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (draggingOpp && draggingOpp.stage !== stage.id) {
                    handleMove(draggingOpp.id, stage.id);
                  }
                  setDraggingOpp(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                  <span className="text-sm font-bold text-content dark:text-content-dark">{isRTL ? stage.label_ar : stage.label_en}</span>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark bg-gray-100 dark:bg-brand-500/15 rounded-full px-1.5 py-px">{stageOpps.length}</span>
                  {stageOpps.length > 0 && (<>
                    {(() => { const staleCount = stageOpps.filter(o => daysSince(o.contacts?.last_activity_at || o.updated_at || o.created_at) >= 7).length; return staleCount > 0 ? <span className="text-[10px] font-semibold text-amber-500" title={isRTL ? 'فرص راكدة' : 'Stale opps'}>⚠ {staleCount}</span> : null; })()}
                    <span className="text-[10px] font-bold text-brand-500 ms-auto">{fmtBudget(stageOpps.reduce((s, o) => s + (o.budget || 0), 0))}</span>
                  </>)}
                </div>
                <div className={`flex flex-col gap-3 min-h-[200px] rounded-xl p-2.5 border border-dashed transition-colors duration-200 ${
                  isOver ? 'bg-brand-500/10 border-brand-500' : 'bg-brand-500/[0.03] dark:bg-brand-500/[0.04] border-edge dark:border-edge-dark'
                }`}>
                  {stageOpps.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/[0.08] flex items-center justify-center mx-auto mb-2">
                        <Grid3X3 size={16} className="text-brand-500 opacity-40" />
                      </div>
                      <p className="text-xs text-content-muted dark:text-content-muted-dark opacity-50 mb-2">{isRTL ? 'اسحب فرصة هنا' : 'Drop here'}</p>
                      <button onClick={() => setShowModal(true)} className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo">
                        <Plus size={10} className="inline -mt-px" /> {isRTL ? 'إضافة' : 'Add'}
                      </button>
                    </div>
                  ) : stageOpps.map(opp => (
                    <div key={opp.id} className="relative"
                      draggable
                      onDragStart={() => setDraggingOpp(opp)}
                      onDragEnd={() => { setDraggingOpp(null); setDragOverStage(null); }}
                    >
                      {bulkMode && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                          className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                            bulkSelected.has(opp.id)
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {bulkSelected.has(opp.id) && '✓'}
                        </button>
                      )}
                      <OppCard opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={bulkMode ? () => toggleBulk(opp.id) : selectOpp} stageConfig={currentStages} score={scoreMap[opp.id]} isAdmin={isAdmin} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>) : (<>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {gridPaged.map(opp => (
            <div key={opp.id} className="relative">
              {bulkMode && (
                <button
                  onClick={e => { e.stopPropagation(); toggleBulk(opp.id); }}
                  className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} z-10 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                    bulkSelected.has(opp.id)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white dark:bg-surface-card-dark border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {bulkSelected.has(opp.id) && '✓'}
                </button>
              )}
              {isDuplicate(opp.contact_id) && (
                <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} z-10`} title={isRTL ? 'فرصة مكررة لنفس العميل' : 'Duplicate: same contact has another opportunity'}>
                  <AlertTriangle size={14} className="text-amber-500" />
                </div>
              )}
              <OppCard opp={opp} isRTL={isRTL} lang={lang} onDelete={handleDelete} onMove={handleMove} onSelect={bulkMode ? () => toggleBulk(opp.id) : selectOpp} stageConfig={getDeptStages(opp.contacts?.department || 'sales')} score={scoreMap[opp.id]} isAdmin={isAdmin} />
            </div>
          ))}
        </div>
        {/* Grid Pagination */}
        {gridTotalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-5">
            <button disabled={gridPage === 1} onClick={() => setGridPage(p => p - 1)}
              className={`px-3.5 py-1.5 rounded-lg border border-edge dark:border-edge-dark text-xs font-semibold font-cairo ${gridPage === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-500/10'} bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark`}>
              {isRTL ? '← السابق' : '← Prev'}
            </button>
            <span className="text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? `${gridSafePage} من ${gridTotalPages}` : `${gridSafePage} of ${gridTotalPages}`}
            </span>
            <button disabled={gridPage >= gridTotalPages} onClick={() => setGridPage(p => p + 1)}
              className={`px-3.5 py-1.5 rounded-lg border border-edge dark:border-edge-dark text-xs font-semibold font-cairo ${gridPage >= gridTotalPages ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-500/10'} bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark`}>
              {isRTL ? 'التالي →' : 'Next →'}
            </button>
          </div>
        )}
      </>)}

      {showModal && <AddModal isRTL={isRTL} lang={lang} onClose={() => setShowModal(false)} onSave={handleSave} agents={agents} projects={projects} existingOpps={opps} currentUserId={profile?.id} />}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-card dark:bg-surface-card-dark border border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">
              {isRTL ? 'حذف فرصة' : 'Delete Opportunity'} {(() => { const o = opps.find(x => x.id === confirmDelete); return o ? `"${getContactName(o)}"` : ''; })()}?
            </h3>
            <p className="m-0 mb-5 text-content-muted dark:text-content-muted-dark text-xs">{isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}</p>
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
    {/* Bulk Operation Toast */}
    {bulkToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-brand-500 to-brand-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'right' : 'left']: 24 }}
      >
        <CheckSquare size={16} />
        {bulkToast}
      </div>
    )}
    {/* Move Warning Toast */}
    {moveWarningToast && (
      <div
        className="fixed bottom-6 z-[300] bg-gradient-to-br from-amber-500 to-amber-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-[slideUp_0.3s_ease-out]"
        style={{ [isRTL ? 'right' : 'left']: 24 }}
      >
        <AlertTriangle size={16} />
        {moveWarningToast}
      </div>
    )}


    {/* Lost Reason Modal */}
    {lostReasonModal && (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5" onClick={() => setLostReasonModal(null)}>
        <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-7 w-full max-w-[420px]" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold text-center">
            {isRTL ? 'سبب الخسارة' : 'Lost Reason'}
          </h3>
          <p className="m-0 mb-4 text-content-muted dark:text-content-muted-dark text-xs text-center">
            {isRTL ? 'لماذا تم خسارة هذه الفرصة؟' : 'Why was this opportunity lost?'}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {configLostReasons.map(r => (
              <button
                key={r.key}
                onClick={() => setLostReason(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-cairo cursor-pointer border-2 transition-all ${
                  lostReason === r.key
                    ? 'border-red-500 bg-red-500/10 text-red-500'
                    : 'border-transparent bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
                }`}
              >
                {isRTL ? r.label_ar : r.label_en}
              </button>
            ))}
            <button
              onClick={() => setLostReason('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-cairo cursor-pointer border-2 transition-all ${
                lostReason === 'other'
                  ? 'border-red-500 bg-red-500/10 text-red-500'
                  : 'border-transparent bg-surface-input dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
              }`}
            >
              {isRTL ? 'أخرى' : 'Other'}
            </button>
          </div>
          {lostReason === 'other' && (
            <Input
              value={lostReasonCustom}
              onChange={e => setLostReasonCustom(e.target.value)}
              placeholder={isRTL ? 'اكتب السبب...' : 'Enter reason...'}
              className="mb-3"
            />
          )}
          <div className="flex gap-2.5 justify-center">
            <Button variant="secondary" size="sm" onClick={() => setLostReasonModal(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="danger" size="sm" onClick={confirmLostReason} disabled={!lostReason || (lostReason === 'other' && !lostReasonCustom.trim())}>
              {isRTL ? 'تأكيد' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Drawer */}
    {selectedOpp && (
      <div
        role="dialog"
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed inset-0 z-[200] bg-black/40 flex ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}
        onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}
      >
        <div className="w-full max-w-[100vw] sm:max-w-[460px] h-full bg-surface-card dark:bg-surface-card-dark shadow-[-8px_0_40px_rgba(0,0,0,0.2)] flex flex-col overflow-y-auto">
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
                <div className="flex items-center gap-2">
                  <p className="m-0 text-base font-bold text-content dark:text-content-dark">{selectedOpp.contacts?.prefix ? selectedOpp.contacts.prefix + ' ' : ''}{getContactName(selectedOpp)}</p>
                  {selectedOpp.contacts?.contact_type && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 font-semibold">
                      {isRTL ? (CONTACT_TYPE_LABELS[selectedOpp.contacts.contact_type]?.ar || selectedOpp.contacts.contact_type) : (CONTACT_TYPE_LABELS[selectedOpp.contacts.contact_type]?.en || selectedOpp.contacts.contact_type)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selectedOpp.contacts?.company && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500 flex items-center gap-0.5"><Building2 size={9} /> {selectedOpp.contacts.company}</span>
                  )}
                  {selectedOpp.contacts?.job_title && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500 flex items-center gap-0.5"><Briefcase size={9} /> {selectedOpp.contacts.job_title}</span>
                  )}
                  {selectedOpp.contacts?.department && (
                    <span className="text-[10px] px-1.5 py-px rounded bg-brand-500/10 text-brand-500">
                      {isRTL ? (DEPT_LABELS[selectedOpp.contacts.department]?.ar || selectedOpp.contacts.department) : (DEPT_LABELS[selectedOpp.contacts.department]?.en || selectedOpp.contacts.department)}
                    </span>
                  )}
                </div>
                {selectedOpp.created_at && (
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5 block">
                    {new Date(selectedOpp.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedOpp.contact_id && (
                <button
                  onClick={() => navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`)}
                  className="bg-transparent border-none cursor-pointer text-brand-500 p-1 rounded-md hover:bg-brand-500/10 transition-colors"
                  title={isRTL ? 'عرض بيانات العميل' : 'View Contact'}
                >
                  <ExternalLink size={15} />
                </button>
              )}
              <button
                onClick={() => editingOpp ? setEditingOpp(false) : startEdit()}
                className="bg-transparent border-none cursor-pointer text-brand-500 p-1 rounded-md hover:bg-brand-500/10 transition-colors"
                title={isRTL ? 'تعديل' : 'Edit'}
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => { setConfirmDelete(selectedOpp.id); }}
                className="bg-transparent border-none cursor-pointer text-red-400 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                title={isRTL ? 'حذف' : 'Delete'}
              >
                <Trash2 size={15} />
              </button>
              {handleOppPrev && (
                <button onClick={handleOppPrev} title={isRTL ? 'السابق' : 'Previous'}
                  className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md hover:bg-brand-500/10 transition-colors">
                  <ChevronUp size={16} />
                </button>
              )}
              {handleOppNext && (
                <button onClick={handleOppNext} title={isRTL ? 'التالي' : 'Next'}
                  className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1 rounded-md hover:bg-brand-500/10 transition-colors">
                  <ChevronDown size={16} />
                </button>
              )}
              <button
                onClick={closeDrawer}
                className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark text-xl leading-none p-1 hover:text-content dark:hover:text-content-dark transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Contact Quick Actions */}
          {!editingOpp && selectedOpp.contacts && (
            <div className="px-6 py-3 border-b border-edge dark:border-edge-dark">
              <div className="flex gap-2 flex-wrap">
                {selectedOpp.contacts.phone && (
                  <a href={`tel:${selectedOpp.contacts.phone}`} dir="ltr" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 no-underline hover:bg-brand-500/20 transition-colors font-semibold">
                    <Phone size={13} /> {selectedOpp.contacts.phone}
                  </a>
                )}
                {selectedOpp.contacts.phone2 && (
                  <a href={`tel:${selectedOpp.contacts.phone2}`} dir="ltr" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 no-underline hover:bg-brand-500/20 transition-colors font-semibold">
                    <Phone size={13} /> {selectedOpp.contacts.phone2}
                  </a>
                )}
                {selectedOpp.contacts.phone && (<>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedOpp.contacts.phone); setBulkToast(isRTL ? 'تم نسخ الرقم' : 'Phone copied'); setTimeout(() => setBulkToast(null), 2000); }}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/10 text-content-muted dark:text-content-muted-dark border-none cursor-pointer hover:bg-gray-200 dark:hover:bg-white/15 transition-colors font-semibold font-cairo"
                    title={isRTL ? 'نسخ الرقم' : 'Copy phone'}
                  >
                    📋
                  </button>
                  <a href={`https://wa.me/${(selectedOpp.contacts.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors font-semibold">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                </>)}
                {selectedOpp.contacts.email && (
                  <a href={`mailto:${selectedOpp.contacts.email}`} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 no-underline hover:bg-blue-500/20 transition-colors font-semibold">
                    <Mail size={13} /> {selectedOpp.contacts.email}
                  </a>
                )}
              </div>
              {/* Extra info row */}
              <div className="flex gap-2 flex-wrap mt-2">
                {selectedOpp.contacts.source && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    <ExternalLink size={9} /> {isRTL ? (SOURCE_LABELS[selectedOpp.contacts.source]?.ar || selectedOpp.contacts.source) : (SOURCE_LABELS[selectedOpp.contacts.source]?.en || selectedOpp.contacts.source)}
                  </span>
                )}
                {selectedOpp.contacts.preferred_location && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    <MapPin size={9} /> {selectedOpp.contacts.preferred_location}
                  </span>
                )}
                {selectedOpp.contacts.nationality && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    {isRTL ? ({egyptian:'مصري',saudi:'سعودي',emirati:'إماراتي',kuwaiti:'كويتي',qatari:'قطري',libyan:'ليبي',other:'أخرى'}[selectedOpp.contacts.nationality] || selectedOpp.contacts.nationality) : selectedOpp.contacts.nationality}
                  </span>
                )}
                {selectedOpp.contacts.gender && (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    {isRTL ? (selectedOpp.contacts.gender === 'male' ? 'ذكر' : 'أنثى') : selectedOpp.contacts.gender}
                  </span>
                )}
                {selectedOpp.contacts.birth_date && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    <Calendar size={9} /> {new Date(selectedOpp.contacts.birth_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                )}
                {selectedOpp.contacts.budget_min && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    <Banknote size={9} /> {fmtBudget(selectedOpp.contacts.budget_min)} - {fmtBudget(selectedOpp.contacts.budget_max)}
                  </span>
                )}
                {selectedOpp.contacts.interested_in_type && (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-gray-100 dark:bg-white/5 text-content-muted dark:text-content-muted-dark">
                    {isRTL ? ({residential:'سكني',commercial:'تجاري',administrative:'إداري'}[selectedOpp.contacts.interested_in_type] || selectedOpp.contacts.interested_in_type) : selectedOpp.contacts.interested_in_type}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Drawer Details */}
          <div className="px-6 py-5 flex flex-col gap-4">
            {editingOpp ? (<>
              {/* Edit Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الميزانية' : 'Budget'}</label>
                  <Input type="number" min="0" value={editForm.budget} onChange={e => setEditForm(f => ({ ...f, budget: Math.max(0, e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المسؤول' : 'Agent'}</label>
                  <Select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'المرحلة' : 'Stage'}</label>
                  <Select value={editForm.stage} onChange={e => setEditForm(f => ({ ...f, stage: e.target.value }))}>
                    {getDeptStages(selectedOpp.contacts?.department || 'sales').map(s => <option key={s.id} value={s.id}>{isRTL ? s.label_ar : s.label_en}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">{isRTL ? 'الإغلاق المتوقع' : 'Expected Close'}</label>
                  <Input type="date" value={editForm.expected_close_date} onChange={e => setEditForm(f => ({ ...f, expected_close_date: e.target.value }))} />
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
                  { label: isRTL ? 'المرحلة' : 'Stage', value: deptStageLabel(selectedOpp.stage, selectedOpp.contacts?.department || 'sales', isRTL), color: (getDeptStages(selectedOpp.contacts?.department || 'sales').find(s => s.id === selectedOpp.stage)?.color || '#4A7AAB') },
                  { label: isRTL ? 'الميزانية' : 'Budget', value: fmtBudget(selectedOpp.budget) + ' ' + (isRTL ? 'ج' : 'EGP'), color: '#4A7AAB' },
                  { label: isRTL ? 'الحرارة' : 'Temperature', value: isRTL ? (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_ar : (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).label_en, color: (TEMP_CONFIG[selectedOpp.temperature] || TEMP_CONFIG.cold).color },
                  { label: isRTL ? 'الأولوية' : 'Priority', value: isRTL ? (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_ar : (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).label_en, color: (PRIORITY_CONFIG[selectedOpp.priority] || PRIORITY_CONFIG.medium).color },
                  { label: isRTL ? 'المسؤول' : 'Agent', value: getAgentName(selectedOpp, lang), color: isDark ? '#E2EAF4' : '#1B3347' },
                  { label: isRTL ? 'تم التعيين بواسطة' : 'Assigned By', value: (() => { if (!selectedOpp.assigned_by) return '—'; const a = agents.find(ag => ag.id === selectedOpp.assigned_by); return a ? (lang === 'ar' ? a.full_name_ar : (a.full_name_en || a.full_name_ar)) : '—'; })(), color: '#6B8DB5' },
                  { label: isRTL ? 'في المرحلة منذ' : 'In Stage', value: daysInStage(selectedOpp) + (isRTL ? ' يوم' : ' days'), color: daysInStage(selectedOpp) > 7 ? '#EF4444' : daysInStage(selectedOpp) > 3 ? '#F59E0B' : '#6B8DB5' },
                  ...(selectedOpp.expected_close_date ? [{ label: isRTL ? 'الإغلاق المتوقع' : 'Expected Close', value: new Date(selectedOpp.expected_close_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: new Date(selectedOpp.expected_close_date) < new Date() ? '#EF4444' : '#6B8DB5' }] : []),
                  ...((selectedOpp.contacts?.source || selectedOpp.source) ? [{ label: isRTL ? 'المصدر' : 'Source', value: (() => { const src = selectedOpp.contacts?.source || selectedOpp.source; return isRTL ? (SOURCE_LABELS[src]?.ar || src) : (SOURCE_LABELS[src]?.en || src); })(), color: '#6B8DB5' }] : []),
                  { label: isRTL ? 'عدد فرص العميل' : 'Client Opps', value: opps.filter(o => o.contact_id === selectedOpp.contact_id).length, color: '#6B8DB5' },
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

              {/* Lost Reason */}
              {selectedOpp.lost_reason && selectedOpp.stage === 'closed_lost' && (
                <div className="bg-red-500/[0.08] rounded-xl px-3.5 py-3">
                  <p className="m-0 mb-1 text-xs text-red-500 font-semibold">{isRTL ? 'سبب الخسارة' : 'Lost Reason'}</p>
                  <p className="m-0 text-xs text-content dark:text-content-dark">
                    {LOST_REASONS[selectedOpp.lost_reason]
                      ? (isRTL ? LOST_REASONS[selectedOpp.lost_reason].ar : LOST_REASONS[selectedOpp.lost_reason].en)
                      : selectedOpp.lost_reason}
                  </p>
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
              {(() => {
                const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
                const currentIdx = stages.findIndex(st => st.id === selectedOpp.stage);
                const progressPct = stages.length > 1 ? Math.round((Math.max(0, currentIdx) / (stages.length - 1)) * 100) : 0;
                const isLost = selectedOpp.stage === 'closed_lost';
                return (<>
                  <div className="flex items-center justify-between mb-3">
                    <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                      {isRTL ? 'مراحل التقدم' : 'Pipeline Progress'}
                    </p>
                    <span className="text-xs font-bold" style={{ color: progressPct >= 80 ? '#10B981' : progressPct >= 40 ? '#F59E0B' : '#6B8DB5' }}>
                      {progressPct}%
                    </span>
                  </div>
                  <div className="flex items-start">
                    {stages.map((s, i) => {
                      const isPast = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      const isBackward = !isAdmin && i < currentIdx;
                      return (
                        <div key={s.id} className="flex items-start flex-1 min-w-0">
                          <button
                            onClick={() => !isBackward && handleMove(selectedOpp.id, s.id)}
                            className={`flex flex-col items-center gap-1 bg-transparent border-none w-full group p-0 ${isBackward ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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
                </>);
              })()}
            </div>

            {/* Activities Timeline */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'آخر الأنشطة' : 'Recent Activities'}
                </p>
                <button
                  onClick={() => setShowAddActivity(a => !a)}
                  className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2 py-1 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold"
                >
                  <Plus size={10} className="inline -mt-px" /> {isRTL ? 'سجّل نشاط' : 'Log Activity'}
                </button>
              </div>
              {showAddActivity && (
                <div className="bg-brand-500/[0.06] rounded-xl p-3 mb-3 border border-brand-500/10">
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {Object.entries(ACTIVITY_ICONS).map(([type, Icon]) => (
                      <button
                        key={type}
                        onClick={() => setActivityForm(f => ({ ...f, type }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold font-cairo border-none cursor-pointer transition-colors ${
                          activityForm.type === type
                            ? 'bg-brand-500 text-white'
                            : 'bg-white dark:bg-surface-input-dark text-content-muted dark:text-content-muted-dark'
                        }`}
                      >
                        <Icon size={10} />{type}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={activityForm.description}
                    onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={isRTL ? 'وصف النشاط...' : 'Activity description...'}
                    className="mb-2 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      if (!activityForm.description.trim()) return;
                      const act = await createActivity({
                        type: activityForm.type,
                        description: activityForm.description,
                        contact_id: selectedOpp.contact_id,
                        entity_type: 'opportunity',
                        entity_id: selectedOpp.id,
                      });
                      setDrawerActivities(prev => [act, ...prev].slice(0, 5));
                      setActivityForm({ type: 'call', description: '' });
                      setShowAddActivity(false);
                    }}>
                      {isRTL ? 'حفظ' : 'Save'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddActivity(false)}>
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}
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
              {drawerActivities.length > 0 && selectedOpp.contact_id && (
                <button
                  onClick={() => navigate(`/crm/contacts?highlight=${selectedOpp.contact_id}`)}
                  className="text-[10px] text-brand-500 bg-transparent border-none cursor-pointer hover:underline font-cairo font-semibold mt-1 p-0"
                >
                  {isRTL ? 'عرض كل الأنشطة →' : 'View all activities →'}
                </button>
              )}
            </div>

            {/* Notes Timeline */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="m-0 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                  <StickyNote size={12} className="inline -mt-px" /> {isRTL ? 'الملاحظات' : 'Notes'}
                </p>
                <button
                  onClick={() => setShowNotes(n => !n)}
                  className="text-[10px] text-brand-500 bg-brand-500/10 border-none rounded-md px-2 py-1 cursor-pointer hover:bg-brand-500/20 transition-colors font-cairo font-semibold"
                >
                  {showNotes ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'عرض' : 'Show')} ({drawerNotes.length})
                </button>
              </div>
              {showNotes && (
                <>
                  <div className="flex gap-1.5 mb-2">
                    <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder={isRTL ? 'أضف ملاحظة...' : 'Add note...'} className="text-xs flex-1" onKeyDown={e => {
                      if (e.key === 'Enter' && newNote.trim()) {
                        e.stopPropagation();
                        const note = addOppNote(selectedOpp.id, newNote.trim());
                        setDrawerNotes(prev => [note, ...prev]);
                        setNewNote('');
                      }
                    }} />
                    <Button size="sm" onClick={() => {
                      if (!newNote.trim()) return;
                      const note = addOppNote(selectedOpp.id, newNote.trim());
                      setDrawerNotes(prev => [note, ...prev]);
                      setNewNote('');
                    }}><Plus size={12} /></Button>
                  </div>
                  {drawerNotes.map(n => (
                    <div key={n.id} className="bg-amber-500/[0.06] border border-amber-500/10 rounded-lg p-2.5 mb-1.5 group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 text-xs text-content dark:text-content-dark leading-relaxed flex-1">{n.text}</p>
                        <button onClick={() => { deleteOppNote(selectedOpp.id, n.id); setDrawerNotes(prev => prev.filter(x => x.id !== n.id)); }} className="bg-transparent border-none cursor-pointer text-red-400 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><X size={11} /></button>
                      </div>
                      <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">{new Date(n.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Stage History */}
            {stageHistory.length > 0 && (
              <div>
                <p className="m-0 mb-2 text-xs font-semibold text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'سجل المراحل' : 'Stage History'}
                </p>
                <div className="space-y-1">
                  {stageHistory.slice(0, 5).map((h, i) => {
                    const stages = getDeptStages(selectedOpp.contacts?.department || 'sales');
                    const fromLabel = stages.find(s => s.id === h.from);
                    const toLabel = stages.find(s => s.id === h.to);
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-content-muted dark:text-content-muted-dark bg-gray-50 dark:bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold" style={{ color: fromLabel?.color || '#6B8DB5' }}>{isRTL ? (fromLabel?.label_ar || h.from) : (fromLabel?.label_en || h.from)}</span>
                        <span>→</span>
                        <span className="font-semibold" style={{ color: toLabel?.color || '#6B8DB5' }}>{isRTL ? (toLabel?.label_ar || h.to) : (toLabel?.label_en || h.to)}</span>
                        <span className="ms-auto">{new Date(h.at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lead Score */}
            {!editingOpp && (
              <div className="bg-brand-500/[0.08] rounded-xl px-3.5 py-3">
                <p className="m-0 mb-1.5 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'درجة العميل' : 'Lead Score'}</p>
                {(() => {
                  const score = scoreMap[selectedOpp.id] ?? calcLeadScore(selectedOpp);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: scoreColor(score) }} />
                      </div>
                      <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                      <span className="text-[10px] font-semibold" style={{ color: scoreColor(score) }}>{scoreLabel(score, isRTL)}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Follow Up Reminder */}
            <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={getContactName(selectedOpp)} />
          </div>
        </div>
        <div className="flex-1" onClick={closeDrawer} />
      </div>
    )}
  </>);
}
