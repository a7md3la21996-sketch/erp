import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDS } from '../../hooks/useDesignSystem';
import { useAuth } from '../../contexts/AuthContext';
import {
  Phone, MessageCircle, Mail, Users, MapPin, FileText,
  UserCheck, AlertTriangle, Star, Receipt, Banknote,
  RefreshCw, CheckSquare, Plus, X, Clock, Trash2
} from 'lucide-react';
import { fetchActivities, createActivity, deleteActivity, ACTIVITY_TYPES } from '../../services/activitiesService';

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
  const c = useDS();
  const { user } = useAuth();
  const lang = i18n.language;
  const isDark = c.dark;
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
    <div style={{ fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Clock size={15} color={c.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
            {lang === 'ar' ? 'سجل الأنشطة' : 'Activity Log'}
          </span>
          {activities.length > 0 && (
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: c.accent + '20', color: c.accent, fontWeight: 600 }}>
              {activities.length}
            </span>
          )}
        </div>
        <button onClick={() => setAdding(!adding)} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7,
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: adding ? 'transparent' : c.accent, color: adding ? c.muted : '#fff',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {adding ? <X size={13} /> : <Plus size={13} />}
          {adding ? (lang === 'ar' ? 'إلغاء' : 'Cancel') : (lang === 'ar' ? 'إضافة نشاط' : 'Add Activity')}
        </button>
      </div>

      {/* Add Form */}
      {adding && (
        <div style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid ' + c.border }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {availableTypes.map(([key, val]) => {
              const Ic = ICONS[val.icon];
              const sel = form.type === key;
              return (
                <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
                  border: '1px solid ' + (sel ? val.color : c.border), cursor: 'pointer', fontSize: 11, fontWeight: sel ? 600 : 400,
                  background: sel ? val.color + '18' : 'transparent', color: sel ? val.color : c.muted,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}>
                  {Ic && <Ic size={12} />}
                  {lang === 'ar' ? val.ar : val.en}
                </button>
              );
            })}
          </div>
          {/* Notes */}
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={lang === 'ar' ? 'ملاحظات...' : 'Notes...'}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid ' + c.border,
              background: c.input, color: c.text, fontSize: 13, resize: 'vertical',
              outline: 'none', boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr',
            }}
          />
          <div style={{ display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end', marginTop: 8 }}>
            <button onClick={handleAdd} disabled={saving || !form.notes.trim()} style={{
              padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: c.primary, color: '#fff', fontSize: 12, fontWeight: 600,
              opacity: saving || !form.notes.trim() ? 0.6 : 1,
            }}>
              {saving ? '...' : (lang === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: c.muted, fontSize: 12, padding: 20 }}>
          {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : activities.length === 0 ? (
        <div style={{ textAlign: 'center', color: c.muted, fontSize: 12, padding: 20 }}>
          {lang === 'ar' ? 'لا يوجد أنشطة بعد' : 'No activities yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activities.slice(0, compact ? 5 : 999).map((act, idx) => {
            const typeDef = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
            const Ic = ICONS[typeDef.icon] || FileText;
            return (
              <div key={act.id} className="activity-row" style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 6px', borderRadius: 8,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                borderBottom: idx < activities.length - 1 ? '1px solid ' + c.border : 'none',
              }}
                onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: typeDef.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic size={13} color={typeDef.color} />
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: typeDef.color }}>
                      {lang === 'ar' ? typeDef.ar : typeDef.en}
                    </span>
                    <span style={{ fontSize: 11, color: c.muted }}>
                      {act.user_name_ar && lang === 'ar' ? act.user_name_ar : act.user_name_en || ''}
                    </span>
                    <span style={{ fontSize: 11, color: c.muted, marginRight: 'auto' }}>
                      {timeAgo(act.created_at, lang)}
                    </span>
                  </div>
                  {act.notes && (
                    <div style={{ fontSize: 12, color: c.text, marginTop: 2, lineHeight: 1.5, direction: isRTL ? 'rtl' : 'ltr' }}>
                      {act.notes}
                    </div>
                  )}
                </div>
                {/* Delete */}
                <button onClick={() => handleDelete(act.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 3,
                  color: c.muted, opacity: 0, flexShrink: 0,
                }}
                  className="delete-btn"
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
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
