import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Trash2, Building2, Banknote, User, Zap, AlertTriangle, Calendar, Timer, ExternalLink } from 'lucide-react';
import {
  TEMP_CONFIG, PRIORITY_CONFIG, actLabel, getContactName, getAgentName, getProjectName,
  initials, avatarColor, fmtBudget, calcLeadScore, scoreColor, daysInStage, daysSince,
} from './constants';

export default function OppCard({ opp, isRTL, lang, onDelete, onMove, onSelect, stageConfig, score: preScore, isAdmin, sourceLabelsMap = {} }) {
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
              <div className="text-xs text-content-muted dark:text-content-muted-dark" dir="ltr">{opp.contacts?.phone}</div>
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
        const srcLabel = sourceLabelsMap[src];
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
