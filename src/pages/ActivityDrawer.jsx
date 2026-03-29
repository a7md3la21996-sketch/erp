import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  X, Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Clock, Link2, User, Pencil,
  CloudOff, Calendar, Trash2,
} from 'lucide-react';
import { ACTIVITY_TYPES } from '../services/activitiesService';
import { Button, Textarea, Badge } from '../components/ui';
import { useEscClose } from '../utils/hooks';

const ICONS = {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare,
};

const RESULT_LABELS = {
  answered:      { ar: 'رد',          en: 'Answered',       color: '#10B981' },
  no_answer:     { ar: 'لم يرد',      en: 'No Answer',      color: '#F59E0B' },
  busy:          { ar: 'مشغول',       en: 'Busy',           color: '#EF4444' },
  switched_off:  { ar: 'مغلق',        en: 'Switched Off',   color: '#6b7280' },
  wrong_number:  { ar: 'رقم خاطئ',    en: 'Wrong Number',   color: '#8B5CF6' },
  interested:    { ar: 'مهتم',        en: 'Interested',     color: '#10B981' },
  not_interested:{ ar: 'غير مهتم',   en: 'Not Interested', color: '#EF4444' },
  sent:          { ar: 'تم الإرسال',   en: 'Sent',           color: '#4A7AAB' },
  completed:     { ar: 'مكتمل',       en: 'Completed',      color: '#10B981' },
  cancelled:     { ar: 'ملغي',        en: 'Cancelled',      color: '#EF4444' },
  rescheduled:   { ar: 'تم التأجيل',  en: 'Rescheduled',    color: '#F59E0B' },
};

const DEPT_LABELS = {
  crm:     { ar: 'CRM', en: 'CRM' },
  sales:   { ar: 'المبيعات', en: 'Sales' },
  hr:      { ar: 'HR', en: 'HR' },
  finance: { ar: 'المالية', en: 'Finance' },
};

export default function ActivityDrawer({ activity, onClose, onUpdate, onDelete }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  useEscClose(onClose);

  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(activity?.notes || '');
  const [saving, setSaving] = useState(false);

  if (!activity) return null;

  const typeDef = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.note;
  const Ic = ICONS[typeDef.icon] || FileText;
  const deptDef = DEPT_LABELS[activity.dept];
  const resultDef = activity.result ? RESULT_LABELS[activity.result] : null;

  const handleSaveNotes = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(activity.id, { notes: editNotes });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[998]" onClick={onClose} />

      {/* Drawer */}
      <div
        className={`fixed top-0 ${isRTL ? 'left-0' : 'right-0'} h-full w-full max-w-[480px] bg-surface-card dark:bg-surface-card-dark shadow-2xl z-[999] flex flex-col overflow-hidden`}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge dark:border-edge-dark bg-surface-bg dark:bg-surface-bg-dark">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: typeDef.color + '18' }}
            >
              <Ic size={20} color={typeDef.color} />
            </div>
            <div>
              <h2 className="m-0 text-base font-bold text-content dark:text-content-dark">
                {isRTL ? typeDef.ar : typeDef.en}
              </h2>
              <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">
                {fmtDate(activity.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-brand-500/10 text-content-muted dark:text-content-muted-dark"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Type */}
            <div className="rounded-xl p-3 bg-surface-bg dark:bg-surface-bg-dark">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'نوع النشاط' : 'Activity Type'}
              </p>
              <div className="flex items-center gap-1.5">
                <Ic size={14} color={typeDef.color} />
                <span className="text-sm font-semibold text-content dark:text-content-dark">
                  {isRTL ? typeDef.ar : typeDef.en}
                </span>
              </div>
            </div>

            {/* Department */}
            <div className="rounded-xl p-3 bg-surface-bg dark:bg-surface-bg-dark">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'القسم' : 'Department'}
              </p>
              <span className="text-sm font-semibold text-content dark:text-content-dark">
                {deptDef ? (isRTL ? deptDef.ar : deptDef.en) : '—'}
              </span>
            </div>

            {/* Result */}
            <div className="rounded-xl p-3 bg-surface-bg dark:bg-surface-bg-dark">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'النتيجة' : 'Result'}
              </p>
              {resultDef ? (
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded-md inline-block"
                  style={{ background: resultDef.color + '18', color: resultDef.color }}
                >
                  {isRTL ? resultDef.ar : resultDef.en}
                </span>
              ) : (
                <span className="text-sm text-content-muted dark:text-content-muted-dark">—</span>
              )}
            </div>

            {/* Status */}
            <div className="rounded-xl p-3 bg-surface-bg dark:bg-surface-bg-dark">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-1">
                {isRTL ? 'الحالة' : 'Status'}
              </p>
              <span className="text-sm font-semibold text-content dark:text-content-dark flex items-center gap-1">
                {activity._offline && <CloudOff size={12} className="text-red-500" />}
                {activity.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                 activity.status === 'scheduled' ? (isRTL ? 'مجدول' : 'Scheduled') :
                 activity.status || '—'}
              </span>
            </div>
          </div>

          {/* Related Entity */}
          {activity.entity_name && (
            <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
                {isRTL ? 'مرتبط بـ' : 'Related To'}
              </p>
              <div
                className={`flex items-center gap-2 ${activity.contact_id && activity.contact_id !== 'null' ? 'text-brand-500 cursor-pointer hover:underline' : 'text-content dark:text-content-dark'}`}
                onClick={activity.contact_id && activity.contact_id !== 'null' ? () => { onClose(); navigate(`/contacts?highlight=${activity.contact_id}`); } : undefined}
              >
                <Link2 size={14} />
                <span className="text-sm font-semibold">{activity.entity_name}</span>
              </div>
            </div>
          )}

          {/* Done By */}
          {(activity.user_name_ar || activity.user_name_en) && (
            <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
                {isRTL ? 'بواسطة' : 'Done By'}
              </p>
              <div className="flex items-center gap-2 text-content dark:text-content-dark">
                <User size={14} />
                <span className="text-sm font-semibold">
                  {isRTL ? (activity.user_name_ar || activity.user_name_en) : (activity.user_name_en || activity.user_name_ar)}
                </span>
              </div>
            </div>
          )}

          {/* Scheduled Date */}
          {activity.scheduled_date && (
            <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
                {isRTL ? 'تاريخ الموعد' : 'Scheduled Date'}
              </p>
              <div className="flex items-center gap-2 text-content dark:text-content-dark">
                <Calendar size={14} />
                <span className="text-sm font-semibold">{fmtDate(activity.scheduled_date)}</span>
              </div>
            </div>
          )}

          {/* Completed At */}
          {activity.completed_at && (
            <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
                {isRTL ? 'تاريخ الإتمام' : 'Completed At'}
              </p>
              <div className="flex items-center gap-2 text-content dark:text-content-dark">
                <CheckSquare size={14} />
                <span className="text-sm font-semibold">{fmtDate(activity.completed_at)}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'الملاحظات' : 'Notes'}
              </p>
              {onUpdate && !editing && (
                <button
                  onClick={() => { setEditNotes(activity.notes || ''); setEditing(true); }}
                  className="bg-transparent border-none cursor-pointer p-1 text-content-muted dark:text-content-muted-dark hover:text-brand-500"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {editing ? (
              <div>
                <Textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={4}
                  size="sm"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                <div className={`flex gap-2 mt-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveNotes} disabled={saving}>
                    {saving ? '...' : (isRTL ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="m-0 text-sm text-content dark:text-content-dark leading-relaxed whitespace-pre-wrap">
                {activity.notes || activity.description || (isRTL ? 'لا توجد ملاحظات' : 'No notes')}
              </p>
            )}
          </div>

          {/* Description (if different from notes) */}
          {activity.description && activity.description !== activity.notes && (
            <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark mb-4">
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
                {isRTL ? 'الوصف' : 'Description'}
              </p>
              <p className="m-0 text-sm text-content dark:text-content-dark leading-relaxed">
                {activity.description}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="rounded-xl p-4 bg-surface-bg dark:bg-surface-bg-dark">
            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark mb-2">
              {isRTL ? 'معلومات إضافية' : 'Details'}
            </p>
            <div className="space-y-2 text-xs text-content-muted dark:text-content-muted-dark">
              <div className="flex items-center justify-between">
                <span>{isRTL ? 'تاريخ الإنشاء' : 'Created'}</span>
                <span className="text-content dark:text-content-dark font-medium">{fmtDate(activity.created_at)}</span>
              </div>
              {activity.entity_type && (
                <div className="flex items-center justify-between">
                  <span>{isRTL ? 'نوع الكيان' : 'Entity Type'}</span>
                  <span className="text-content dark:text-content-dark font-medium">{activity.entity_type}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>ID</span>
                <span className="text-content dark:text-content-dark font-medium font-mono text-[10px]">{activity.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {onDelete && (
          <div className="px-5 py-3 border-t border-edge dark:border-edge-dark bg-surface-bg dark:bg-surface-bg-dark">
            <Button
              variant="secondary"
              size="sm"
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full justify-center"
              onClick={() => onDelete(activity.id)}
            >
              <Trash2 size={14} />
              {isRTL ? 'حذف النشاط' : 'Delete Activity'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
