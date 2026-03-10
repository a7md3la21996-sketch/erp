import { useState, useRef, useEffect } from "react";
import FollowUpReminder from '../../components/ui/FollowUpReminder';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';

const STAGE_CONFIG = [
  { id: "all",                  label_ar: "الكل",            label_en: "All",             color: "#4A7AAB" },
  { id: "new",                  label_ar: "جديد",            label_en: "New",             color: "#4A7AAB" },
  { id: "contacted",            label_ar: "تم التواصل",      label_en: "Contacted",       color: "#4A7AAB" },
  { id: "interested",           label_ar: "مهتم",            label_en: "Interested",      color: "#4A7AAB" },
  { id: "site_visit_scheduled", label_ar: "موعد معاينة",     label_en: "Visit Scheduled", color: "#2B4C6F" },
  { id: "site_visited",         label_ar: "تمت المعاينة",    label_en: "Site Visited",    color: "#2B4C6F" },
  { id: "negotiation",          label_ar: "تفاوض",           label_en: "Negotiation",     color: "#1B3347" },
  { id: "reserved",             label_ar: "محجوز",           label_en: "Reserved",        color: "#1B3347" },
  { id: "closed_won",           label_ar: "تم الإغلاق",      label_en: "Closed Won",      color: "#1B3347" },
  { id: "closed_lost",          label_ar: "خسارة",           label_en: "Closed Lost",     color: "#EF4444" },
];
const TEMP_CONFIG = {
  hot:  { label_ar: "ساخن", label_en: "Hot",  color: "#EF4444", bg: "rgba(239,68,68,0.10)",   lucide: "Flame"       },
  warm: { label_ar: "دافئ", label_en: "Warm", color: "#F97316", bg: "rgba(249,115,22,0.10)",  lucide: "Thermometer" },
  cool: { label_ar: "عادي", label_en: "Cool", color: "#8BA8C8", bg: "rgba(139,168,200,0.10)", lucide: "Wind"        },
  cold: { label_ar: "بارد", label_en: "Cold", color: "#4A7AAB", bg: "rgba(74,122,171,0.10)",  lucide: "Snowflake"   },
};
const PRIORITY_CONFIG = {
  urgent: { label_ar: "عاجل",  label_en: "Urgent", color: "#EF4444" },
  high:   { label_ar: "عالي",  label_en: "High",   color: "#4A7AAB" },
  medium: { label_ar: "متوسط", label_en: "Medium", color: "#6B8DB5" },
  low:    { label_ar: "منخفض", label_en: "Low",    color: "#8BA8C8" },
};
const AGENT_OPTIONS   = ["احمد محمد", "سارة علي", "محمود حسن", "نورا احمد", "خالد عمر"];
const PROJECT_OPTIONS = ["سيليا العاصمة الادارية", "بلو تري المرج", "تاون جيت 6 اكتوبر", "ريفان الشيخ زايد"];
const MOCK_OPPORTUNITIES = [
  { id:1,  contactName:"محمد عبد الله", contactId:1,  budget:2500000, agent:"احمد محمد",  temperature:"hot",  priority:"urgent", stage:"new",                  project:"سيليا العاصمة الادارية", lastActivityDays:0,  notes:"مهتم بشقة 3 غرف" },
  { id:2,  contactName:"سمر الحسيني",   contactId:2,  budget:1800000, agent:"سارة علي",   temperature:"warm", priority:"medium", stage:"new",                  project:"بلو تري المرج",          lastActivityDays:1,  notes:"" },
  { id:3,  contactName:"كريم فوزي",     contactId:3,  budget:3200000, agent:"محمود حسن",  temperature:"hot",  priority:"high",   stage:"contacted",            project:"تاون جيت 6 اكتوبر",     lastActivityDays:0,  notes:"احالة من عميل قديم" },
  { id:4,  contactName:"هالة منصور",    contactId:4,  budget:950000,  agent:"نورا احمد",  temperature:"cold", priority:"low",    stage:"contacted",            project:"",                       lastActivityDays:5,  notes:"" },
  { id:5,  contactName:"طارق ابراهيم",  contactId:5,  budget:4100000, agent:"احمد محمد",  temperature:"hot",  priority:"urgent", stage:"interested",           project:"سيليا العاصمة الادارية", lastActivityDays:0,  notes:"يريد فيلا" },
  { id:6,  contactName:"ريم السيد",     contactId:6,  budget:2100000, agent:"سارة علي",   temperature:"warm", priority:"medium", stage:"interested",           project:"ريفان الشيخ زايد",       lastActivityDays:2,  notes:"" },
  { id:7,  contactName:"وليد جمال",     contactId:7,  budget:5500000, agent:"محمود حسن",  temperature:"hot",  priority:"high",   stage:"site_visit_scheduled", project:"سيليا العاصمة الادارية", lastActivityDays:0,  notes:"موعد الخميس 3م" },
  { id:8,  contactName:"دينا مصطفى",   contactId:8,  budget:1350000, agent:"نورا احمد",  temperature:"cool", priority:"medium", stage:"site_visited",         project:"بلو تري المرج",          lastActivityDays:1,  notes:"" },
  { id:9,  contactName:"احمد رضوان",    contactId:9,  budget:2900000, agent:"خالد عمر",   temperature:"warm", priority:"medium", stage:"negotiation",          project:"تاون جيت 6 اكتوبر",     lastActivityDays:3,  notes:"اعجبته الوحدة B204" },
  { id:10, contactName:"منى الشريف",    contactId:10, budget:1650000, agent:"احمد محمد",  temperature:"warm", priority:"medium", stage:"negotiation",          project:"بلو تري المرج",          lastActivityDays:1,  notes:"تطلب خصم 5%" },
  { id:11, contactName:"عمر البدري",    contactId:11, budget:3800000, agent:"سارة علي",   temperature:"hot",  priority:"high",   stage:"reserved",             project:"سيليا العاصمة الادارية", lastActivityDays:0,  notes:"تفاوض على المقدم" },
  { id:12, contactName:"لمياء خليل",    contactId:12, budget:7200000, agent:"خالد عمر",   temperature:"hot",  priority:"urgent", stage:"closed_won",           project:"ريفان الشيخ زايد",       lastActivityDays:7,  notes:"تعاقد" },
  { id:13, contactName:"ياسر نجيب",     contactId:13, budget:4500000, agent:"محمود حسن",  temperature:"hot",  priority:"urgent", stage:"closed_won",           project:"سيليا العاصمة الادارية", lastActivityDays:7,  notes:"تعاقد" },
  { id:14, contactName:"ايمان فريد",    contactId:14, budget:1200000, agent:"نورا احمد",  temperature:"cold", priority:"low",    stage:"closed_lost",          project:"",                       lastActivityDays:14, notes:"السعر خارج الميزانية" },
];
const fmtBudget = (n) => { if(!n) return "-"; if(n>=1000000) return (n/1000000).toFixed(1)+"M"; if(n>=1000) return (n/1000).toFixed(0)+"K"; return n.toLocaleString(); };
const actLabel = (d,isRTL) => { if(d===0) return {text:isRTL?"اليوم":"Today",color:"#4A7AAB"}; if(d===1) return {text:isRTL?"امس":"Yesterday",color:"#6B8DB5"}; if(d<=3) return {text:d+(isRTL?"د":"d"),color:"#8BA8C8"}; return {text:d+(isRTL?"د":"d"),color:"#EF4444"}; };
const initials = (n) => (n||"").trim().split(" ").map(w=>w[0]).slice(0,2).join("")||"?";
const ACOLORS = ["#1B3347","#2B4C6F","#4A7AAB","#6B8DB5","#8BA8C8","#1B3347","#2B4C6F","#4A7AAB"];
const avatarColor = (id) => ACOLORS[id%ACOLORS.length];
const IPlus    = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>;
const ISearch  = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IX       = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>;
const IDots    = (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
const IUser    = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IMoney   = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>;
const ITrash   = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IFlame   = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
const IGrid    = (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
const IBuilding= (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>;

function OppCard({ opp, isDark, isRTL, onDelete, onMove, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const temp  = TEMP_CONFIG[opp.temperature]  || TEMP_CONFIG.cold;
  const prio  = PRIORITY_CONFIG[opp.priority] || PRIORITY_CONFIG.medium;
  const act   = actLabel(opp.lastActivityDays, isRTL);
  const stage = STAGE_CONFIG.find(s => s.id === opp.stage) || STAGE_CONFIG[1];
  useEffect(() => {
    const h = (e) => { if(menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div style={{ background: isDark?"#1a2234":"#fff", border:`1px solid ${isDark?"rgba(74,122,171,0.15)":"#e5e7eb"}`, borderRadius:14, padding:"16px", display:"flex", flexDirection:"column", gap:12, position:"relative", overflow:"hidden", boxShadow: isDark?"0 2px 8px rgba(0,0,0,0.3)":"0 1px 4px rgba(0,0,0,0.06)", transition:"box-shadow 0.2s, transform 0.2s", cursor:"pointer" }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow=isDark?"0 8px 24px rgba(0,0,0,0.4)":"0 8px 24px rgba(27,51,71,0.12)";e.currentTarget.style.transform="translateY(-2px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow=isDark?"0 2px 8px rgba(0,0,0,0.3)":"0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.transform="none";}}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:stage.color, borderRadius:"14px 14px 0 0" }} />
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, background:avatarColor(opp.contactId), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff" }}>{initials(opp.contactName)}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:isDark?"#E2EAF4":"#1B3347", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{opp.contactName}</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:2 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:stage.color }} />
              <span style={{ fontSize:11, color:stage.color, fontWeight:600 }}>{isRTL?stage.label_ar:stage.label_en}</span>
            </div>
          </div>
        </div>
        <div ref={menuRef} style={{ position:"relative", flexShrink:0 }}>
          <button onClick={(e)=>{e.stopPropagation();setMenuOpen(m=>!m);}} style={{ background:"none", border:"none", cursor:"pointer", color:isDark?"#8BA8C8":"#9ca3af", padding:4, borderRadius:6, display:"flex" }}>
            <IDots style={{ width:15, height:15 }} />
          </button>
          {menuOpen && (
            <div style={{ position:"absolute", [isRTL?"left":"right"]:0, top:"100%", zIndex:50, background:isDark?"#0F1E2D":"#fff", border:`1px solid ${isDark?"rgba(74,122,171,0.2)":"#e5e7eb"}`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.15)", minWidth:170, overflow:"hidden" }}>
              <div style={{ padding:"6px 0", borderBottom:`1px solid ${isDark?"rgba(74,122,171,0.1)":"#f3f4f6"}` }}>
                <div style={{ padding:"4px 12px", fontSize:10, fontWeight:600, color:isDark?"#8BA8C8":"#9ca3af" }}>{isRTL?"نقل الى":"Move to"}</div>
                {STAGE_CONFIG.filter(s=>s.id!=="all"&&s.id!==opp.stage).slice(0,5).map(s=>(
                  <button key={s.id} onClick={()=>{onMove(opp.id,s.id);setMenuOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 12px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:isDark?"#E2EAF4":"#E2EAF4", fontFamily:"inherit", textAlign:isRTL?"right":"left" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }} />
                    {isRTL?s.label_ar:s.label_en}
                  </button>
                ))}
              </div>
              <button onClick={()=>{onDelete(opp.id);setMenuOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 12px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#ef4444", fontFamily:"inherit" }}>
                <ITrash style={{ width:13, height:13 }} />{isRTL?"حذف":"Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
      {opp.project && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:isDark?"#8BA8C8":"#6b7280" }}><IBuilding style={{ width:12, height:12, flexShrink:0 }} /><span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{opp.project}</span></div>}
      <div onClick={e=>e.stopPropagation()} style={{ borderTop:`1px solid ${isDark?"rgba(74,122,171,0.1)":"#f3f4f6"}`, paddingTop:8, marginTop:0 }}>
        <select value={opp.stage} onChange={e=>{e.stopPropagation();onMove(opp.id,e.target.value);}}
          style={{ width:"100%", padding:"6px 10px", borderRadius:8, border:`1px solid ${stage.color}44`, background:isDark?"#0F1E2D":"#f8fafc", color:stage.color, fontSize:11, fontWeight:700, cursor:"pointer", outline:"none", fontFamily:"inherit" }}>
          {STAGE_CONFIG.filter(s=>s.id!=="all").map(s=>(
            <option key={s.id} value={s.id} style={{ color: isDark?"#E2EAF4":"#1B3347", background: isDark?"#0F1E2D":"#fff", fontWeight: s.id===opp.stage?700:400 }}>
              {isRTL?s.label_ar:s.label_en}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:4, background:isDark?"rgba(74,122,171,0.1)":"rgba(74,122,171,0.08)", borderRadius:6, padding:"4px 9px", fontSize:12, fontWeight:700, color:"#4A7AAB" }}>
          <IMoney style={{ width:11, height:11 }} />{fmtBudget(opp.budget)} {isRTL?"ج":"EGP"}
        </div>
        <div style={{ borderRadius:6, padding:"4px 9px", fontSize:11, fontWeight:600, background:temp.bg, color:temp.color }}>{isRTL?temp.label_ar:temp.label_en}</div>
        <div style={{ borderRadius:6, padding:"4px 9px", fontSize:11, fontWeight:600, background:`${prio.color}18`, color:prio.color }}>{isRTL?prio.label_ar:prio.label_en}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:10, borderTop:`1px solid ${isDark?"rgba(74,122,171,0.1)":"#f3f4f6"}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:isDark?"#8BA8C8":"#6b7280" }}><IUser style={{ width:11, height:11 }} />{opp.agent}</div>
        <div style={{ fontSize:11, fontWeight:700, color:act.color }}>{act.text}</div>
      </div>
      {opp.notes && <div style={{ fontSize:11, color:isDark?"#8BA8C8":"#9ca3af", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:-4 }}>{opp.notes}</div>}
    </div>
  );
}

function AddModal({ isDark, isRTL, onClose, onSave }) {
  const [form, setForm] = useState({ contactName:"", budget:"", agent:AGENT_OPTIONS[0], temperature:"hot", priority:"medium", stage:"new", project:"", notes:"" });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const inp = { width:"100%", padding:"8px 12px", borderRadius:8, boxSizing:"border-box", border:`1px solid ${isDark?"rgba(74,122,171,0.2)":"#e5e7eb"}`, background:isDark?"#0F1E2D":"#fff", color:isDark?"#E2EAF4":"#1B3347", fontSize:13, outline:"none", fontFamily:"inherit" };
  const lbl = (t) => <label style={{ fontSize:12, fontWeight:600, color:isDark?"#8BA8C8":"#6b7280", marginBottom:4, display:"block" }}>{t}</label>;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)" }} />
      <div style={{ position:"relative", width:520, maxHeight:"90vh", overflowY:"auto", background:isDark?"#1a2234":"#fff", borderRadius:16, padding:24, zIndex:1, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", direction:isRTL?"rtl":"ltr" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:isDark?"#E2EAF4":"#1B3347" }}>{isRTL?"اضافة فرصة جديدة":"Add New Opportunity"}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:isDark?"#8BA8C8":"#6b7280", padding:4 }}><IX style={{ width:18, height:18 }} /></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"span 2" }}>{lbl(isRTL?"اسم العميل *":"Client Name *")}<input style={inp} value={form.contactName} onChange={e=>f("contactName",e.target.value)} /></div>
          <div>{lbl(isRTL?"الميزانية":"Budget")}<input style={inp} type="number" value={form.budget} onChange={e=>f("budget",e.target.value)} /></div>
          <div>{lbl(isRTL?"المسؤول":"Agent")}<select style={inp} value={form.agent} onChange={e=>f("agent",e.target.value)}>{AGENT_OPTIONS.map(a=><option key={a}>{a}</option>)}</select></div>
          <div>{lbl(isRTL?"المشروع":"Project")}<select style={inp} value={form.project} onChange={e=>f("project",e.target.value)}><option value="">{isRTL?"بدون مشروع":"No Project"}</option>{PROJECT_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></div>
          <div>{lbl(isRTL?"المرحلة":"Stage")}<select style={inp} value={form.stage} onChange={e=>f("stage",e.target.value)}>{STAGE_CONFIG.filter(s=>s.id!=="all").map(s=><option key={s.id} value={s.id}>{isRTL?s.label_ar:s.label_en}</option>)}</select></div>
          <div style={{ gridColumn:"span 2" }}>
            {lbl(isRTL?"الحرارة":"Temperature")}
            <div style={{ display:"flex", gap:6 }}>
              {Object.entries(TEMP_CONFIG).map(([k,v])=>(
                <button key={k} onClick={()=>f("temperature",k)} style={{ flex:1, padding:"7px 0", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", border:`2px solid ${form.temperature===k?v.color:"transparent"}`, background:form.temperature===k?v.bg:(isDark?"#0F1E2D":"#f9fafb"), color:form.temperature===k?v.color:(isDark?"#8BA8C8":"#6b7280"), transition:"all 0.15s" }}>{isRTL?v.label_ar:v.label_en}</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn:"span 2" }}>{lbl(isRTL?"ملاحظات":"Notes")}<textarea style={{ ...inp, resize:"vertical", minHeight:70 }} value={form.notes} onChange={e=>f("notes",e.target.value)} /></div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={()=>form.contactName&&onSave({...form,budget:Number(form.budget)||0,id:Date.now(),lastActivityDays:0,contactId:Date.now()})} style={{ padding:"10px 24px", borderRadius:8, border:"none", cursor:"pointer", background:"#1B3347", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>{isRTL?"حفظ":"Save"}</button>
          <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:8, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${isDark?"rgba(74,122,171,0.2)":"#e5e7eb"}`, background:"none", color:isDark?"#8BA8C8":"#6b7280", fontSize:13 }}>{isRTL?"الغاء":"Cancel"}</button>
        </div>
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [opps, setOpps]             = useState(MOCK_OPPORTUNITIES);
  const [search, setSearch]         = useState("");
  const [activeStage, setActiveStage] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterTemp, setFilterTemp] = useState("all");
  const [showModal, setShowModal]   = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const c = { bg:isDark?"#152232":"#f9fafb", cardBg:isDark?"#1a2234":"#fff", border:isDark?"rgba(74,122,171,0.2)":"#e5e7eb", text:isDark?"#E2EAF4":"#111827", textMuted:isDark?"#8BA8C8":"#6b7280", inputBg:isDark?"#0F1E2D":"#fff" };
  const totalBudget = opps.reduce((s,o)=>s+(o.budget||0),0);
  const wonCount    = opps.filter(o=>o.stage==="closed_won").length;
  const hotCount    = opps.filter(o=>o.temperature==="hot").length;
  const filtered = opps.filter(o=>{
    if(activeStage!=="all"&&o.stage!==activeStage) return false;
    if(search&&!o.contactName.includes(search)&&!(o.project||"").includes(search)) return false;
    if(filterAgent!=="all"&&o.agent!==filterAgent) return false;
    if(filterTemp!=="all"&&o.temperature!==filterTemp) return false;
    return true;
  });
  const handleMove   = (id,toStage) => setOpps(p=>p.map(o=>o.id===id?{...o,stage:toStage}:o));
  const handleDelete = (id) => setOpps(p=>p.filter(o=>o.id!==id));
  const handleSave   = (opp) => { setOpps(p=>[...p,opp]); setShowModal(false); };
  const sel = { padding:"8px 12px", borderRadius:8, fontSize:13, border:`1px solid ${c.border}`, background:c.inputBg, color:c.text, fontFamily:"inherit", outline:"none", cursor:"pointer" };
  return (<>
    <div style={{ minHeight:"100vh", background:c.bg, fontFamily:"Cairo,Tajawal,sans-serif", direction:isRTL?"rtl":"ltr", padding:"20px 20px 40px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#1B3347,#4A7AAB)", display:"flex", alignItems:"center", justifyContent:"center" }}><IGrid style={{ width:18, height:18, color:"#fff" }} /></div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:c.text }}>{isRTL?"الفرص البيعية":"Opportunities"}</h1>
          </div>
          <p style={{ margin:0, fontSize:13, color:c.textMuted }}>{isRTL?"ادارة وتتبع فرص المبيعات":"Manage and track sales opportunities"}</p>
        </div>
        <button onClick={()=>setShowModal(true)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:10, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#1B3347,#2B4C6F)", color:"#fff", fontSize:13, fontWeight:700, fontFamily:"inherit", boxShadow:"0 4px 12px rgba(27,51,71,0.3)" }}>
          <IPlus style={{ width:15, height:15 }} />{isRTL?"اضافة فرصة":"Add Opportunity"}
        </button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {[{label:isRTL?"اجمالي الفرص":"Total",value:opps.length,color:"#4A7AAB",I:IGrid},{label:isRTL?"اجمالي الميزانيات":"Budget",value:fmtBudget(totalBudget)+(isRTL?" ج":" EGP"),color:"#4A7AAB",I:IMoney},{label:isRTL?"صفقات مغلقة":"Won",value:wonCount,color:"#2B4C6F",I:IBuilding},{label:isRTL?"فرص ساخنة":"Hot",value:hotCount,color:"#EF4444",I:IFlame}].map((s,i)=>(
          <div key={i} style={{ flex:"1 1 140px", background:c.cardBg, borderRadius:12, padding:"14px 16px", border:`1px solid ${c.border}`, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:s.color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><s.I style={{ width:16, height:16, color:s.color }} /></div>
            <div><div style={{ fontSize:18, fontWeight:800, color:c.text }}>{s.value}</div><div style={{ fontSize:11, color:c.textMuted }}>{s.label}</div></div>
          </div>
        ))}
      </div>
      <div style={{ background:c.cardBg, borderRadius:12, padding:"10px 14px", marginBottom:16, border:`1px solid ${c.border}`, display:"flex", gap:6, flexWrap:"wrap" }}>
        {STAGE_CONFIG.map(s=>{
          const count = s.id==="all"?opps.length:opps.filter(o=>o.stage===s.id).length;
          const active = activeStage===s.id;
          return <button key={s.id} onClick={()=>setActiveStage(s.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?700:500, whiteSpace:"nowrap", background:active?s.color:"transparent", color:active?"#fff":c.textMuted, transition:"all 0.15s" }}>
            {isRTL?s.label_ar:s.label_en}
            <span style={{ fontSize:10, fontWeight:700, borderRadius:99, padding:"1px 6px", background:active?"rgba(255,255,255,0.25)":(isDark?"rgba(74,122,171,0.15)":"#f3f4f6"), color:active?"#fff":c.textMuted }}>{count}</span>
          </button>;
        })}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:"1 1 200px" }}>
          <ISearch style={{ position:"absolute", top:"50%", transform:"translateY(-50%)", [isRTL?"right":"left"]:10, width:14, height:14, color:c.textMuted, pointerEvents:"none" }} />
          <input placeholder={isRTL?"بحث...":"Search..."} value={search} onChange={e=>setSearch(e.target.value)} style={{ ...sel, width:"100%", boxSizing:"border-box", [isRTL?"paddingRight":"paddingLeft"]:32 }} />
        </div>
        <select style={sel} value={filterAgent} onChange={e=>setFilterAgent(e.target.value)}>
          <option value="all">{isRTL?"كل المسؤولين":"All Agents"}</option>
          {AGENT_OPTIONS.map(a=><option key={a}>{a}</option>)}
        </select>
        <select style={sel} value={filterTemp} onChange={e=>setFilterTemp(e.target.value)}>
          <option value="all">{isRTL?"كل الحرارة":"All Temps"}</option>
          {Object.entries(TEMP_CONFIG).map(([k,v])=><option key={k} value={k}>{isRTL?v.label_ar:v.label_en}</option>)}
        </select>
        {(search||filterAgent!=="all"||filterTemp!=="all")&&<button onClick={()=>{setSearch("");setFilterAgent("all");setFilterTemp("all");}} style={{ padding:"8px 10px", borderRadius:8, border:"none", cursor:"pointer", background:"#ef444422", color:"#ef4444", display:"flex" }}><IX style={{ width:14, height:14 }} /></button>}
        <div style={{ marginInlineStart:"auto", fontSize:12, color:c.textMuted }}>{filtered.length} {isRTL?"فرصة":"opportunities"}</div>
      </div>
      {filtered.length===0
        ? (<div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'rgba(74,122,171,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <TrendingUp size={24} color='#4A7AAB' />
                </div>
                <p style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:c.text }}>{isRTL?'لا توجد فرص بيع':'No Opportunities Found'}</p>
                <p style={{ margin:0, fontSize:13, color:c.textMuted }}>{isRTL?'لم يتم إضافة أي فرص بيع بعد':'No sales opportunities have been added yet'}</p>
              </div>)
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
            {filtered.map(opp=><OppCard key={opp.id} opp={opp} isDark={isDark} isRTL={isRTL} onDelete={handleDelete} onMove={handleMove} onSelect={setSelectedOpp} />)}
          </div>
      }
      {showModal&&<AddModal isDark={isDark} isRTL={isRTL} onClose={()=>setShowModal(false)} onSave={handleSave} />}
    </div>

      {selectedOpp && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', flexDirection:'row-reverse' }} onClick={e => { if(e.target===e.currentTarget) setSelectedOpp(null); }}>
          <div style={{ width:'100%', maxWidth:460, height:'100%', background:isDark?'#1a2234':'#fff', boxShadow:'-8px 0 40px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', overflowY:'auto', animation:'slideIn 0.25s ease' }}>
            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${c.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexDirection:isRTL?'row-reverse':'row', background:isDark?'#152232':'#F8FAFC' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexDirection:isRTL?'row-reverse':'row' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:avatarColor(selectedOpp.contactId), display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff' }}>{initials(selectedOpp.contactName)}</div>
                <div style={{ textAlign:isRTL?'right':'left' }}>
                  <p style={{ margin:0, fontSize:16, fontWeight:700, color:isDark?'#E2EAF4':'#1B3347' }}>{selectedOpp.contactName}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:5, flexDirection:isRTL?'row-reverse':'row' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:(STAGE_CONFIG.find(s=>s.id===selectedOpp.stage)||STAGE_CONFIG[1]).color }} />
                    <span style={{ fontSize:12, color:(STAGE_CONFIG.find(s=>s.id===selectedOpp.stage)||STAGE_CONFIG[1]).color, fontWeight:600 }}>{isRTL?(STAGE_CONFIG.find(s=>s.id===selectedOpp.stage)||STAGE_CONFIG[1]).label_ar:(STAGE_CONFIG.find(s=>s.id===selectedOpp.stage)||STAGE_CONFIG[1]).label_en}</span>
                  </div>
                </div>
              </div>
              <button onClick={()=>setSelectedOpp(null)} style={{ background:'none', border:'none', cursor:'pointer', color:isDark?'#8BA8C8':'#6b7280', fontSize:20, lineHeight:1, padding:4 }}>✕</button>
            </div>

            {/* Details */}
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:isRTL?'الميزانية':'Budget', value:fmtBudget(selectedOpp.budget)+' '+(isRTL?'ج':'EGP'), color:'#4A7AAB' },
                  { label:isRTL?'الحرارة':'Temperature', value:isRTL?(TEMP_CONFIG[selectedOpp.temperature]||TEMP_CONFIG.cold).label_ar:(TEMP_CONFIG[selectedOpp.temperature]||TEMP_CONFIG.cold).label_en, color:(TEMP_CONFIG[selectedOpp.temperature]||TEMP_CONFIG.cold).color },
                  { label:isRTL?'الأولوية':'Priority', value:isRTL?(PRIORITY_CONFIG[selectedOpp.priority]||PRIORITY_CONFIG.medium).label_ar:(PRIORITY_CONFIG[selectedOpp.priority]||PRIORITY_CONFIG.medium).label_en, color:(PRIORITY_CONFIG[selectedOpp.priority]||PRIORITY_CONFIG.medium).color },
                  { label:isRTL?'المسؤول':'Agent', value:selectedOpp.agent||'-', color:isDark?'#E2EAF4':'#1B3347' },
                ].map((item,i) => (
                  <div key={i} style={{ background:isDark?'rgba(74,122,171,0.08)':'#F0F4F8', borderRadius:10, padding:'12px 14px' }}>
                    <p style={{ margin:'0 0 4px', fontSize:11, color:isDark?'#8BA8C8':'#6b7280', textAlign:isRTL?'right':'left' }}>{item.label}</p>
                    <p style={{ margin:0, fontSize:14, fontWeight:700, color:item.color, textAlign:isRTL?'right':'left' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Project */}
              {selectedOpp.project && (
                <div style={{ background:isDark?'rgba(74,122,171,0.08)':'#F0F4F8', borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:11, color:isDark?'#8BA8C8':'#6b7280', textAlign:isRTL?'right':'left' }}>{isRTL?'المشروع':'Project'}</p>
                  <p style={{ margin:0, fontSize:14, fontWeight:600, color:isDark?'#E2EAF4':'#1B3347', textAlign:isRTL?'right':'left' }}>{selectedOpp.project}</p>
                </div>
              )}

              {/* Notes */}
              {selectedOpp.notes && (
                <div style={{ background:isDark?'rgba(74,122,171,0.08)':'#F0F4F8', borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:11, color:isDark?'#8BA8C8':'#6b7280', textAlign:isRTL?'right':'left' }}>{isRTL?'ملاحظات':'Notes'}</p>
                  <p style={{ margin:0, fontSize:13, color:isDark?'#E2EAF4':'#1B3347', textAlign:isRTL?'right':'left', lineHeight:1.6 }}>{selectedOpp.notes}</p>
                </div>
              )}

              {/* Change Stage */}
              <div>
                <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:600, color:isDark?'#8BA8C8':'#6b7280', textAlign:isRTL?'right':'left' }}>{isRTL?'تغيير المرحلة':'Change Stage'}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, flexDirection:isRTL?'row-reverse':'row' }}>
                  {STAGE_CONFIG.filter(s=>s.id!=='all').map(s => (
                    <button key={s.id} onClick={()=>{ setOpps(prev=>prev.map(o=>o.id===selectedOpp.id?{...o,stage:s.id}:o)); setSelectedOpp(p=>({...p,stage:s.id})); }}
                      style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${s.id===selectedOpp.stage?s.color:c.border}`, background:s.id===selectedOpp.stage?s.color+'18':'transparent', color:s.id===selectedOpp.stage?s.color:isDark?'#8BA8C8':'#6b7280', fontSize:11, fontWeight:s.id===selectedOpp.stage?700:400, cursor:'pointer' }}>
                      {isRTL?s.label_ar:s.label_en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow Up Reminder */}
              <FollowUpReminder entityType="opportunity" entityId={String(selectedOpp.id)} entityName={selectedOpp.contactName} />
            </div>
          </div>
          <div style={{ flex:1, background:'rgba(0,0,0,0.4)' }} onClick={()=>setSelectedOpp(null)} />
        </div>
      )}
  </>);
}