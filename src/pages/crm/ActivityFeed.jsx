import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Plus, X, Clock, Trash2
} from 'lucide-react';
import { fetchActivities, createActivity, deleteActivity, ACTIVITY_TYPES } from '../../services/activitiesService';
import { Button, Badge, Textarea } from '../../components/ui';

const ICONS = {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare,
};

function timeAgo(dateStr, lang) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return lang === 'ar' ? 'الآن' : 'Just now';
  if (diff < 3600) return lang === 'ar' ? `${Math.floor(diff/60)} د` : `${Math.floor(diff/60)}m`;
  if (diff < 86400)return lang === 'ar' ? `${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h`;
  return lang === 'ar' ? `${Math.floor(diff/86400)} يوم` : `${Math.floor(diff/86400)}d`;
}

export default function ActivityFeed({ entityType = 'contact', entityId, dept = 'crm', compact = false }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language;
  const isRTL = lang === 'ar';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState({ type: 'call', notes: '' });
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchActivities({ entityType, entityId, dept: entityId ? undefined : dept });
      setActivities(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [entityId, entityType, dept]);

  const handleAdd = async () => {
    if (!form.notes.trim()) return;
    setSaving(true);
    try {
      await createActivity({
        type: form.type,
        notes: form.notes,
        entityType,
        entityId,
        dept,
        userId: user?.id,
      });
      setForm({ type: 'call', notes: '' });
      setAdding(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await deleteActivity(id);
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  // Filter types by dept
  const availableTypes = Object.entries(ACTIVITY_TYPES).filter(([, v]) => v.dept.includes(dept));

  return (
    <div>
      {/* Header */}
      <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <Clock size={15} className="text-brand-500" />
          <span className="text-xs font-semibold text-content dark:text-content-dark">
            {lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log'}
          </span>
          {activities.length > 0 && (
            <Badge variant="default" size="sm">
              {activities.length}
            </Badge>
          )}
        </div>
        {adding ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className={isRTL ? 'flex-row-reverse' : ''}>
            <X size={13} />
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} className={isRTL ? 'flex-row-reverse' : ''}>
            <Plus size={13} />
            {lang === 'ar' ? 'إضافة نشاط' : 'Add Activity'}
          </Button>
        )}
      </div>

      {/* Add Form */}
      {adding && (
        <div className="bg-blue-50/60 dark:bg-brand-500/[0.08] rounded-xl p-3.5 mb-3.5 border border-edge dark:border-edge-dark">
          {/* Type selector */}
          <div className={`flex gap-1.5 flex-wrap mb-2.5 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            {availableTypes.map(([key, val]) => {
              const Ic = ICONS[val.icon];
              const sel = form.type === key;
              return (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors duration-150 border ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${sel ? 'font-semibold' : 'font-normal'}`}
                  style={{
                    borderColor: sel ? val.color : undefined,
                    background: sel ? val.color + '18' : 'transparent',
                    color: sel ? val.color : undefined,
                  }}
                >
                  {Ic && <Ic size={12} />}
                  {lang === 'ar' ? val.ar : val.en}
                </button>
              );
            })}
          </div>
          {/* Notes */}
          <Textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={lang === 'ar' ? 'ملاحظات...' : 'Notes...'}
            rows={2}
            size="md"
            className={isRTL ? 'direction-rtl' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <div className={`flex mt-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !form.notes.trim()}
            >
              {saving ? '...' : (lang === 'ar' ? 'حفظ' : 'Save')}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center text-content-muted dark:text-content-muted-dark text-xs py-5">
          {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center text-content-muted dark:text-content-muted-dark text-xs py-5">
          {lang === 'ar' ? 'لا يوجد أنشطة بعد' : 'No activities yet'}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {activities.slice(0, compact ? 5 : 999).map((act, idx) => {
            const typeDef = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
            const Ic = ICONS[typeDef.icon] || FileText;
            return (
              <div
                key={act.id}
                className={`group flex items-start gap-2.5 py-2 px-1.5 rounded-lg transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-brand-500/[0.06] ${isRTL ? 'flex-row-reverse' : 'flex-row'} ${idx < activities.length - 1 ? 'border-b border-edge dark:border-edge-dark' : ''}`}
              >
                {/* Icon */}
                <div
                  className="w-[30px] h-[30px] rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ background: typeDef.color + '18' }}
                >
                  <Ic size={13} color={typeDef.color} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-1.5 flex-wrap ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs font-semibold" style={{ color: typeDef.color }}>
                      {lang === 'ar' ? typeDef.ar : typeDef.en}
                    </span>
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">
                      {act.user_name_ar && lang === 'ar' ? act.user_name_ar : act.user_name_en || ''}
                    </span>
                    <span className="text-xs text-content-muted dark:text-content-muted-dark mr-auto">
                      {timeAgo(act.created_at, lang)}
                    </span>
                  </div>
                  {act.notes && (
                    <div
                      className="text-xs text-content dark:text-content-dark mt-0.5 leading-relaxed"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {act.notes}
                    </div>
                  )}
                </div>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(act.id)}
                  className="bg-transparent border-none cursor-pointer p-1 text-content-muted dark:text-content-muted-dark opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
