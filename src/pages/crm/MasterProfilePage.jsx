import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Phone, Mail, Award, Calendar, User, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import {
  fetchContactsByPhone,
  fetchMasterProfileTimeline,
  fetchMasterProfileDeals,
} from '../../services/contactsService';
import { PageSkeleton } from '../../components/ui';

const STATUS_COLORS = {
  new: '#3B82F6',
  contacted: '#F59E0B',
  following: '#10B981',
  has_opportunity: '#8B5CF6',
  disqualified: '#6B7280',
  inactive: '#9CA3AF',
};

const TEMP_COLORS = {
  hot: '#EF4444',
  warm: '#F59E0B',
  cool: '#3B82F6',
  cold: '#6B7280',
};

const ACTIVITY_ICONS = {
  call: Phone,
  whatsapp: Activity,
  email: Mail,
  meeting: Calendar,
  status_change: TrendingUp,
  reassignment: User,
};

export default function MasterProfilePage() {
  const { phone } = useParams();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const decoded = decodeURIComponent(phone || '');
        const recs = await fetchContactsByPhone(decoded);
        if (cancelled) return;
        setRecords(recs);
        if (recs.length > 0) {
          const ids = recs.map(r => r.id);
          const [tl, ds] = await Promise.all([
            fetchMasterProfileTimeline(ids),
            fetchMasterProfileDeals(ids),
          ]);
          if (!cancelled) {
            setTimeline(tl);
            setDeals(ds);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [phone]);

  const wonDeal = useMemo(() => deals.find(d => d.status === 'won' || d.status === 'closed_won'), [deals]);
  const totalActivities = timeline.length;
  const recordsByContact = useMemo(() => {
    const map = {};
    for (const t of timeline) {
      map[t.contact_id] = (map[t.contact_id] || 0) + 1;
    }
    return map;
  }, [timeline]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{isRTL ? 'حدث خطأ' : 'Error'}: {error}</span>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400">
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'رجوع' : 'Back'}</span>
        </button>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          {isRTL ? 'لا توجد سجلات لهذا الرقم' : 'No records found for this phone number'}: {phone}
        </div>
      </div>
    );
  }

  const decodedPhone = decodeURIComponent(phone);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
        <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        <span>{isRTL ? 'رجوع' : 'Back'}</span>
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>{isRTL ? 'بروفايل موحد' : 'Master Profile'}</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] font-medium">
                {isRTL ? 'للمدراء فقط' : 'Admin Only'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" dir="ltr">
              {decodedPhone}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {records[0]?.full_name}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{records.length}</div>
              <div className="text-xs text-gray-500">{isRTL ? 'سجل' : 'Records'}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalActivities}</div>
              <div className="text-xs text-gray-500">{isRTL ? 'نشاط' : 'Activities'}</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${wonDeal ? 'text-green-600' : 'text-gray-400'}`}>
                {deals.length}
              </div>
              <div className="text-xs text-gray-500">{isRTL ? 'صفقة' : 'Deals'}</div>
            </div>
          </div>
        </div>

        {wonDeal && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-3">
            <Award className="w-5 h-5 text-green-600" />
            <div>
              <div className="text-sm font-semibold text-green-900 dark:text-green-300">
                {isRTL ? 'تم إغلاق صفقة' : 'Deal Won'}
              </div>
              <div className="text-xs text-green-700 dark:text-green-400">
                {isRTL ? 'بواسطة' : 'By'}: {isRTL ? wonDeal.agent_ar : wonDeal.agent_en} • {wonDeal.deal_value || '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Records list */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {isRTL ? `السجلات (${records.length})` : `Records (${records.length})`}
      </h2>
      <div className="space-y-2 mb-6">
        {records.map(r => {
          const status = r.contact_status || 'new';
          const temp = r.temperature || 'cold';
          const activityCount = recordsByContact[r.id] || 0;
          const dealForRecord = deals.find(d => d.contact_id === r.id);
          const isWon = dealForRecord && (dealForRecord.status === 'won' || dealForRecord.status === 'closed_won');
          return (
            <Link
              key={r.id}
              to={`/contacts?highlight=${r.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {(r.assigned_to_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {r.assigned_to_name || (isRTL ? 'غير معين' : 'Unassigned')}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.contact_number || r.id.slice(0, 8)} • {isRTL ? 'منذ' : 'created'}{' '}
                      {new Date(r.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ background: STATUS_COLORS[status] || '#6B7280' }}
                  >
                    {status}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ background: TEMP_COLORS[temp] || '#6B7280' }}
                  >
                    {temp}
                  </span>
                  {activityCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {activityCount} {isRTL ? 'نشاط' : 'activities'}
                    </span>
                  )}
                  {isWon && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      ✓ {isRTL ? 'فاز' : 'Won'}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Combined timeline */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {isRTL ? 'الـ Timeline الموحد' : 'Combined Timeline'}
      </h2>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {timeline.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isRTL ? 'لا توجد أنشطة' : 'No activities yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {timeline.slice(0, 100).map(act => {
              const Icon = ACTIVITY_ICONS[act.type] || Activity;
              const author = isRTL ? (act.user_name_ar || act.user_name_en) : (act.user_name_en || act.user_name_ar);
              const ownerRecord = records.find(r => r.id === act.contact_id);
              return (
                <div key={act.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{author || '—'}</span>
                      <span className="text-xs text-gray-500">{act.type}</span>
                      {ownerRecord && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          → {ownerRecord.assigned_to_name || ownerRecord.contact_number}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ms-auto">
                        {new Date(act.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{act.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {timeline.length > 100 && (
              <div className="p-3 text-center text-xs text-gray-500">
                {isRTL ? `+${timeline.length - 100} نشاط إضافي` : `+${timeline.length - 100} more activities`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
