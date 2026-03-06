import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

// ════════════════════════════════════════════════════════════════
//  MOCK DATA & CONSTANTS
// ════════════════════════════════════════════════════════════════

const STAGE_CONFIG = [
  { id: "new",                   label_ar: "جديد",              label_en: "New",               color: "#4A7AAB", bg: "#EDF2F7" },
  { id: "contacted",             label_ar: "تم التواصل",        label_en: "Contacted",         color: "#8b5cf6", bg: "#F5F3FF" },
  { id: "interested",            label_ar: "مهتم",              label_en: "Interested",        color: "#D4A853", bg: "#FFFBEB" },
  { id: "site_visit_scheduled",  label_ar: "موعد معاينة",       label_en: "Visit Scheduled",   color: "#10b981", bg: "#ECFDF5" },
  { id: "site_visited",          label_ar: "تمت المعاينة",      label_en: "Site Visited",      color: "#06b6d4", bg: "#ECFEFF" },
  { id: "negotiation",           label_ar: "تفاوض",             label_en: "Negotiation",       color: "#f97316", bg: "#FFF7ED" },
  { id: "reserved",              label_ar: "محجوز",             label_en: "Reserved",          color: "#1B3347", bg: "#EDF2F7" },
  { id: "closed_won",            label_ar: "تم الإغلاق ✓",     label_en: "Closed Won",        color: "#22c55e", bg: "#F0FDF4" },
  { id: "closed_lost",           label_ar: "خسارة",             label_en: "Closed Lost",       color: "#ef4444", bg: "#FEF2F2" },
];

const TEMP_CONFIG = {
  hot:  { label_ar: "ساخن",  color: "#ef4444", bg: "#FEE2E2" },
  warm: { label_ar: "دافئ",  color: "#f97316", bg: "#FFEDD5" },
  cool: { label_ar: "عادي",  color: "#EAB308", bg: "#FEF9C3" },
  cold: { label_ar: "بارد",  color: "#3b82f6", bg: "#DBEAFE" },
};

const PRIORITY_CONFIG = {
  urgent: { label_ar: "عاجل",   color: "#ef4444" },
  high:   { label_ar: "عالي",   color: "#f97316" },
  medium: { label_ar: "متوسط",  color: "#D4A853" },
  low:    { label_ar: "منخفض",  color: "#6B8DB5" },
};

const SOURCE_OPTIONS = ["فيسبوك", "إنستجرام", "جوجل", "موقع الشركة", "إحالة", "اتصال مباشر", "معرض عقاري"];
const AGENT_OPTIONS  = ["أحمد محمد", "سارة علي", "محمود حسن", "نورا أحمد", "خالد عمر"];
const PROJECT_OPTIONS = ["سيليا العاصمة الإدارية", "بلو تري المرج", "تاون جيت 6 أكتوبر", "ريفان الشيخ زايد"];

const MOCK_OPPORTUNITIES = [
  { id: 1,  contactName: "محمد عبد الله",  contactId: 1,  budget: 2500000,  source: "فيسبوك",         agent: "أحمد محمد",   temperature: "hot",  priority: "urgent", stage: "new",                  project: "سيليا العاصمة الإدارية",  lastActivityDays: 0, type: "new",        notes: "مهتم جداً بشقة 3 غرف" },
  { id: 2,  contactName: "سمر الحسيني",    contactId: 2,  budget: 1800000,  source: "موقع الشركة",   agent: "سارة علي",    temperature: "warm", priority: "medium", stage: "new",                  project: "بلو تري المرج",           lastActivityDays: 1, type: "new",        notes: "" },
  { id: 3,  contactName: "كريم فوزي",      contactId: 3,  budget: 3200000,  source: "إحالة",          agent: "محمود حسن",   temperature: "hot",  priority: "high",   stage: "contacted",            project: "تاون جيت 6 أكتوبر",      lastActivityDays: 0, type: "new",        notes: "إحالة من عميل قديم" },
  { id: 4,  contactName: "هالة منصور",     contactId: 4,  budget: 950000,   source: "إنستجرام",      agent: "نورا أحمد",   temperature: "cold", priority: "low",    stage: "contacted",            project: "",                        lastActivityDays: 5, type: "reassigned", notes: "" },
  { id: 5,  contactName: "طارق إبراهيم",   contactId: 5,  budget: 4100000,  source: "معرض عقاري",    agent: "أحمد محمد",   temperature: "hot",  priority: "urgent", stage: "interested",           project: "سيليا العاصمة الإدارية",  lastActivityDays: 0, type: "new",        notes: "يريد فيلا أو بنتهاوس" },
  { id: 6,  contactName: "ريم السيد",      contactId: 6,  budget: 2100000,  source: "إحالة",          agent: "سارة علي",    temperature: "warm", priority: "medium", stage: "interested",           project: "ريفان الشيخ زايد",        lastActivityDays: 2, type: "additional", notes: "" },
  { id: 7,  contactName: "وليد جمال",      contactId: 7,  budget: 5500000,  source: "جوجل",           agent: "محمود حسن",   temperature: "hot",  priority: "high",   stage: "site_visit_scheduled", project: "سيليا العاصمة الإدارية",  lastActivityDays: 0, type: "new",        notes: "موعد الخميس 3م" },
  { id: 8,  contactName: "دينا مصطفى",    contactId: 8,  budget: 1350000,  source: "موقع الشركة",   agent: "نورا أحمد",   temperature: "cool", priority: "medium", stage: "site_visit_scheduled", project: "بلو تري المرج",           lastActivityDays: 1, type: "new",        notes: "" },
  { id: 9,  contactName: "أحمد رضوان",     contactId: 9,  budget: 2900000,  source: "فيسبوك",         agent: "خالد عمر",    temperature: "warm", priority: "medium", stage: "site_visited",         project: "تاون جيت 6 أكتوبر",      lastActivityDays: 3, type: "new",        notes: "أعجبته الوحدة B204" },
  { id: 10, contactName: "منى الشريف",     contactId: 10, budget: 1650000,  source: "اتصال مباشر",   agent: "أحمد محمد",   temperature: "warm", priority: "medium", stage: "negotiation",          project: "بلو تري المرج",           lastActivityDays: 1, type: "new",        notes: "تطلب خصم 5%" },
  { id: 11, contactName: "عمر البدري",      contactId: 11, budget: 3800000,  source: "إحالة",          agent: "سارة علي",    temperature: "hot",  priority: "high",   stage: "negotiation",          project: "سيليا العاصمة الإدارية",  lastActivityDays: 0, type: "reopened",   notes: "تفاوض على دفعة المقدم" },
  { id: 12, contactName: "لمياء خليل",     contactId: 12, budget: 7200000,  source: "معرض عقاري",    agent: "خالد عمر",    temperature: "hot",  priority: "urgent", stage: "reserved",             project: "ريفان الشيخ زايد",        lastActivityDays: 2, type: "new",        notes: "حجز فيلا كورنر" },
  { id: 13, contactName: "ياسر نجيب",      contactId: 13, budget: 4500000,  source: "جوجل",           agent: "محمود حسن",   temperature: "hot",  priority: "urgent", stage: "closed_won",           project: "سيليا العاصمة الإدارية",  lastActivityDays: 7, type: "new",        notes: "تعاقد ✓" },
  { id: 14, contactName: "إيمان فريد",     contactId: 14, budget: 1200000,  source: "إنستجرام",      agent: "نورا أحمد",   temperature: "cold", priority: "low",    stage: "closed_lost",          project: "",                        lastActivityDays: 14, type: "new",       notes: "السعر خارج الميزانية" },
];

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════
const fmtBudget = (n) => {
  if (!n) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
};

const activityLabel = (days) => {
  if (days === 0) return { text: "اليوم",        color: "#22c55e" };
  if (days === 1) return { text: "أمس",           color: "#86efac" };
  if (days <= 3)  return { text: `${days}د`,      color: "#D4A853" };
  if (days <= 7)  return { text: `${days}د`,      color: "#f97316" };
  return             { text: `${days}د`,           color: "#ef4444" };
};

const initials = (name) => name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("") || "?";

const AVATAR_COLORS = ["#4A7AAB","#8b5cf6","#10b981","#f97316","#D4A853","#06b6d4","#ef4444","#1B3347"];
const avatarColor = (id) => AVATAR_COLORS[id % AVATAR_COLORS.length];

// ════════════════════════════════════════════════════════════════
//  ICONS (inline SVG — no emoji, no external lib)
// ════════════════════════════════════════════════════════════════
const Icon = {
  Plus: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Search: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Filter: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  X: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  Dots: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  ),
  Phone: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Link: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Edit: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  ArrowRight: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  Building: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
    </svg>
  ),
  Money: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
    </svg>
  ),
  Calendar: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  ),
  Flame: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ),
  Close: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  ),
  Kanban: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="5" height="12" rx="1"/><rect x="10" y="3" width="5" height="7" rx="1"/><rect x="17" y="3" width="5" height="10" rx="1"/>
    </svg>
  ),
};

// ════════════════════════════════════════════════════════════════
//  ADD OPPORTUNITY MODAL
// ════════════════════════════════════════════════════════════════
function AddOpportunityModal({ isDark, onClose, onSave, defaultStage }) {
  const [form, setForm] = useState({
    contactName: "", budget: "", source: SOURCE_OPTIONS[0],
    agent: AGENT_OPTIONS[0], temperature: "hot", priority: "medium",
    stage: defaultStage || "new", project: "", notes: "", type: "new",
  });

  const field = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
    background: isDark ? "#0f172a" : "#fff",
    color: isDark ? "#e2e8f0" : "#1B3347",
    fontSize: 13, outline: "none",
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 4, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "relative", width: 520, maxHeight: "90vh", overflowY: "auto",
        background: isDark ? "#1e293b" : "#fff",
        borderRadius: 16, padding: 24, zIndex: 1,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        direction: "rtl",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? "#e2e8f0" : "#1B3347" }}>
            إضافة فرصة جديدة
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#94a3b8" : "#64748b", padding: 4 }}>
            <Icon.X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Client Name */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>اسم العميل *</label>
            <input style={inputStyle} placeholder="اسم العميل" value={form.contactName}
              onChange={e => field("contactName", e.target.value)} />
          </div>

          {/* Budget */}
          <div>
            <label style={labelStyle}>الميزانية (جنيه)</label>
            <input style={inputStyle} type="number" placeholder="مثال: 2500000"
              value={form.budget} onChange={e => field("budget", e.target.value)} />
          </div>

          {/* Source */}
          <div>
            <label style={labelStyle}>المصدر</label>
            <select style={inputStyle} value={form.source} onChange={e => field("source", e.target.value)}>
              {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Agent */}
          <div>
            <label style={labelStyle}>المسؤول</label>
            <select style={inputStyle} value={form.agent} onChange={e => field("agent", e.target.value)}>
              {AGENT_OPTIONS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Project */}
          <div>
            <label style={labelStyle}>المشروع</label>
            <select style={inputStyle} value={form.project} onChange={e => field("project", e.target.value)}>
              <option value="">— بدون مشروع —</option>
              {PROJECT_OPTIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label style={labelStyle}>الحرارة</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(TEMP_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => field("temperature", k)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                  border: `2px solid ${form.temperature === k ? v.color : "transparent"}`,
                  background: form.temperature === k ? v.bg : (isDark ? "#334155" : "#f8fafc"),
                  color: form.temperature === k ? v.color : (isDark ? "#94a3b8" : "#64748b"),
                  transition: "all 0.15s",
                }}>{v.label_ar}</button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>الأولوية</label>
            <select style={inputStyle} value={form.priority} onChange={e => field("priority", e.target.value)}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label_ar}</option>
              ))}
            </select>
          </div>

          {/* Stage */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>المرحلة</label>
            <select style={inputStyle} value={form.stage} onChange={e => field("stage", e.target.value)}>
              {STAGE_CONFIG.map(s => <option key={s.id} value={s.id}>{s.label_ar}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>ملاحظات</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
              placeholder="ملاحظات..." value={form.notes}
              onChange={e => field("notes", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-start" }}>
          <button onClick={() => form.contactName && onSave({ ...form, budget: Number(form.budget) || 0, id: Date.now(), lastActivityDays: 0 })}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#1B3347", color: "#fff", fontWeight: 700, fontSize: 13,
              fontFamily: "inherit",
            }}>
            حفظ الفرصة
          </button>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
            background: "none", color: isDark ? "#94a3b8" : "#64748b", fontSize: 13,
          }}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  OPPORTUNITY CARD
// ════════════════════════════════════════════════════════════════
function OpportunityCard({ opp, isDark, isDragging, onDragStart, onEdit, onDelete, onMove, stages }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const temp = TEMP_CONFIG[opp.temperature] || TEMP_CONFIG.cold;
  const prio = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
  const act  = activityLabel(opp.lastActivityDays);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: isDark ? "#1e293b" : "#fff",
        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s, opacity 0.15s",
        position: "relative",
        userSelect: "none",
      }}
    >
      {/* Top row: avatar + name + menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: avatarColor(opp.contactId),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {initials(opp.contactName)}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e2e8f0" : "#1B3347", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {opp.contactName}
          </div>
          {opp.project && (
            <div style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {opp.project}
            </div>
          )}
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: isDark ? "#64748b" : "#94a3b8", padding: 3, borderRadius: 4, display: "flex" }}
          >
            <Icon.Dots style={{ width: 14, height: 14 }} />
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", left: 0, top: "100%", zIndex: 50,
              background: isDark ? "#0f172a" : "#fff",
              border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
              borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              minWidth: 160, overflow: "hidden",
            }}>
              {/* Move submenu */}
              <div style={{ padding: "6px 0", borderBottom: `1px solid ${isDark ? "#334155" : "#E2E8F0"}` }}>
                <div style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, color: isDark ? "#475569" : "#94a3b8" }}>نقل إلى</div>
                {stages.filter(s => s.id !== opp.stage).slice(0, 4).map(s => (
                  <button key={s.id} onClick={() => { onMove(opp.id, s.id); setMenuOpen(false); }} style={{
                    display: "block", width: "100%", textAlign: "right", padding: "6px 12px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 12,
                    color: isDark ? "#cbd5e1" : "#334155",
                  }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color, marginLeft: 6 }} />
                    {s.label_ar}
                  </button>
                ))}
              </div>
              <button onClick={() => { onEdit(opp); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: isDark ? "#cbd5e1" : "#334155", fontSize: 12 }}>
                <Icon.Edit style={{ width: 13, height: 13 }} />
                تعديل
              </button>
              <button onClick={() => { onDelete(opp.id); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12 }}>
                <Icon.Trash style={{ width: 13, height: 13 }} />
                حذف
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Budget + Temp */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: isDark ? "#0f172a" : "#F0F4F8",
          borderRadius: 6, padding: "3px 8px",
          fontSize: 12, fontWeight: 700, color: "#4A7AAB",
        }}>
          <Icon.Money style={{ width: 11, height: 11 }} />
          {fmtBudget(opp.budget)} ج
        </div>
        <div style={{
          borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600,
          background: temp.bg, color: temp.color,
        }}>
          {temp.label_ar}
        </div>
        <div style={{
          borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 600,
          background: `${prio.color}18`, color: prio.color,
        }}>
          {prio.label_ar}
        </div>
      </div>

      {/* Agent + Last Activity */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: isDark ? "#64748b" : "#94a3b8" }}>
          <Icon.User style={{ width: 11, height: 11 }} />
          {opp.agent}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: act.color }}>
          {act.text}
        </div>
      </div>

      {/* Notes preview */}
      {opp.notes && (
        <div style={{
          marginTop: 8, fontSize: 11, color: isDark ? "#475569" : "#94a3b8",
          borderTop: `1px dashed ${isDark ? "#334155" : "#E2E8F0"}`,
          paddingTop: 6, lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {opp.notes}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  KANBAN COLUMN
// ════════════════════════════════════════════════════════════════
function KanbanColumn({ stage, opportunities, isDark, dragState, onDragStart, onDrop, onEdit, onDelete, onMove, stages, onAddCard }) {
  const [isOver, setIsOver] = useState(false);
  const cards = opportunities.filter(o => o.stage === stage.id);
  const totalBudget = cards.reduce((s, c) => s + (c.budget || 0), 0);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsOver(false); onDrop(stage.id); }}
      style={{
        width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
        background: isDark
          ? (isOver ? "#1e293b" : "#0f172a")
          : (isOver ? "#EDF2F7" : "#F8FAFC"),
        borderRadius: 12,
        border: `2px solid ${isOver ? stage.color : (isDark ? "#1e293b" : "#E2E8F0")}`,
        transition: "all 0.15s",
        maxHeight: "calc(100vh - 200px)",
      }}
    >
      {/* Column header */}
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${isDark ? "#1e293b" : "#E2E8F0"}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#e2e8f0" : "#1B3347" }}>
              {stage.label_ar}
            </span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center",
            background: stage.color + "22", color: stage.color,
            borderRadius: 20, padding: "1px 7px",
          }}>
            {cards.length}
          </span>
        </div>
        {totalBudget > 0 && (
          <div style={{ fontSize: 11, color: isDark ? "#475569" : "#94a3b8", marginRight: 18 }}>
            {fmtBudget(totalBudget)} ج إجمالي
          </div>
        )}
      </div>

      {/* Cards scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 4px" }}>
        {cards.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "20px 0", fontSize: 12,
            color: isDark ? "#334155" : "#CBD5E1",
          }}>
            لا توجد فرص
          </div>
        ) : (
          cards.map(opp => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              isDark={isDark}
              isDragging={dragState.dragId === opp.id}
              onDragStart={() => onDragStart(opp.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              stages={stages}
            />
          ))
        )}
      </div>

      {/* Add card button */}
      <div style={{ padding: "8px 10px", flexShrink: 0 }}>
        <button
          onClick={() => onAddCard(stage.id)}
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
            background: "none", color: isDark ? "#475569" : "#94a3b8",
            fontSize: 12, fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? "#1e293b" : "#EDF2F7"; e.currentTarget.style.color = stage.color; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = isDark ? "#475569" : "#94a3b8"; }}
        >
          <Icon.Plus style={{ width: 13, height: 13 }} />
          إضافة فرصة
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function OpportunitiesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const effectiveDark = isDark;
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [opps, setOpps] = useState(MOCK_OPPORTUNITIES);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterTemp, setFilterTemp] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalStage, setAddModalStage] = useState("new");
  const [editTarget, setEditTarget] = useState(null);
  const [dragState, setDragState] = useState({ dragId: null });

  // Stats
  const totalBudget = opps.reduce((s, o) => s + (o.budget || 0), 0);
  const wonCount = opps.filter(o => o.stage === "closed_won").length;
  const hotCount = opps.filter(o => o.temperature === "hot").length;

  // Filtered
  const filtered = opps.filter(o => {
    if (search && !o.contactName.includes(search) && !o.project?.includes(search)) return false;
    if (filterAgent !== "all" && o.agent !== filterAgent) return false;
    if (filterSource !== "all" && o.source !== filterSource) return false;
    if (filterTemp !== "all" && o.temperature !== filterTemp) return false;
    return true;
  });

  // Drag handlers
  const handleDragStart = useCallback((id) => setDragState({ dragId: id }), []);

  const handleDrop = useCallback((targetStage) => {
    if (!dragState.dragId) return;
    setOpps(prev => prev.map(o => o.id === dragState.dragId ? { ...o, stage: targetStage } : o));
    setDragState({ dragId: null });
  }, [dragState.dragId]);

  const handleMove = (id, toStage) => setOpps(prev => prev.map(o => o.id === id ? { ...o, stage: toStage } : o));
  const handleDelete = (id) => setOpps(prev => prev.filter(o => o.id !== id));
  const handleSave = (newOpp) => {
    setOpps(prev => [...prev, newOpp]);
    setShowAddModal(false);
  };

  const selectStyle = {
    padding: "7px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
    border: `1px solid ${effectiveDark ? "#334155" : "#E2E8F0"}`,
    background: effectiveDark ? "#1e293b" : "#fff",
    color: effectiveDark ? "#e2e8f0" : "#1B3347",
    fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: effectiveDark ? "#0f172a" : "#F1F5F9",
      fontFamily: "'Cairo', 'Tajawal', sans-serif",
      direction: "rtl",
      padding: "20px 20px 40px",
    }}>
      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #1B3347, #4A7AAB)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon.Kanban style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: effectiveDark ? "#e2e8f0" : "#1B3347" }}>
              الفرص البيعية
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: effectiveDark ? "#64748b" : "#94a3b8" }}>
            إدارة وتتبع فرص المبيعات عبر مراحل البيع
          </p>
        </div>

        <button
          onClick={() => { setAddModalStage("new"); setShowAddModal(true); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #1B3347, #2B4C6F)",
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(27,51,71,0.3)",
          }}
        >
          <Icon.Plus style={{ width: 15, height: 15 }} />
          إضافة فرصة
        </button>
      </div>

      {/* ── STATS CARDS ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "إجمالي الفرص",  value: opps.length,            color: "#4A7AAB", icon: Icon.Kanban },
          { label: "إجمالي الميزانيات", value: fmtBudget(totalBudget) + " ج", color: "#D4A853", icon: Icon.Money },
          { label: "صفقات مغلقة",   value: wonCount,               color: "#22c55e", icon: Icon.ArrowRight },
          { label: "فرص ساخنة",     value: hotCount,               color: "#ef4444", icon: Icon.Flame },
        ].map((s, i) => (
          <div key={i} style={{
            flex: "1 1 140px", background: effectiveDark ? "#1e293b" : "#fff",
            borderRadius: 12, padding: "14px 16px",
            border: `1px solid ${effectiveDark ? "#334155" : "#E2E8F0"}`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon style={{ width: 16, height: 16, color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: effectiveDark ? "#e2e8f0" : "#1B3347" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: effectiveDark ? "#64748b" : "#94a3b8" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div style={{
        background: effectiveDark ? "#1e293b" : "#fff",
        borderRadius: 12, padding: "12px 16px", marginBottom: 16,
        border: `1px solid ${effectiveDark ? "#334155" : "#E2E8F0"}`,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Icon.Search style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#94a3b8" }} />
          <input
            placeholder="بحث بالاسم أو المشروع..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...selectStyle,
              width: "100%", paddingRight: 32, boxSizing: "border-box",
            }}
          />
        </div>

        {/* Agent filter */}
        <select style={{ ...selectStyle, minWidth: 130 }} value={filterAgent} onChange={e => setFilterAgent(e.target.value)}>
          <option value="all">كل المسؤولين</option>
          {AGENT_OPTIONS.map(a => <option key={a}>{a}</option>)}
        </select>

        {/* Source filter */}
        <select style={{ ...selectStyle, minWidth: 120 }} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="all">كل المصادر</option>
          {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Temp filter */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { val: "all", label: "الكل",  color: effectiveDark ? "#475569" : "#64748b" },
            { val: "hot",  label: "ساخن", color: "#ef4444" },
            { val: "warm", label: "دافئ", color: "#f97316" },
            { val: "cool", label: "عادي", color: "#EAB308" },
            { val: "cold", label: "بارد", color: "#3b82f6" },
          ].map(t => (
            <button key={t.val} onClick={() => setFilterTemp(t.val)} style={{
              padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
              background: filterTemp === t.val ? t.color + "22" : "none",
              color: filterTemp === t.val ? t.color : (effectiveDark ? "#475569" : "#94a3b8"),
              fontWeight: filterTemp === t.val ? 700 : 400,
              fontSize: 12, fontFamily: "inherit",
              outline: filterTemp === t.val ? `1px solid ${t.color}` : "none",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Clear filters */}
        {(search || filterAgent !== "all" || filterSource !== "all" || filterTemp !== "all") && (
          <button onClick={() => { setSearch(""); setFilterAgent("all"); setFilterSource("all"); setFilterTemp("all"); }}
            style={{ padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: "#ef444422", color: "#ef4444", fontSize: 12, fontFamily: "inherit" }}>
            <Icon.X style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>

      {/* ── KANBAN BOARD ── */}
      <div style={{
        display: "flex", gap: 12, overflowX: "auto",
        paddingBottom: 16,
        /* hide scrollbar on webkit */
        scrollbarWidth: "thin",
      }}>
        {STAGE_CONFIG.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            opportunities={filtered}
            isDark={effectiveDark}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onEdit={(opp) => { setEditTarget(opp); setShowAddModal(true); }}
            onDelete={handleDelete}
            onMove={handleMove}
            stages={STAGE_CONFIG}
            onAddCard={(stageId) => { setAddModalStage(stageId); setAddModalStage(stageId); setShowAddModal(true); }}
          />
        ))}
      </div>

      {/* ── MODALS ── */}
      {showAddModal && (
        <AddOpportunityModal
          isDark={effectiveDark}
          defaultStage={addModalStage}
          onClose={() => { setShowAddModal(false); setEditTarget(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
