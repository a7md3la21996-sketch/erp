import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../../lib/supabase';
import { Award, TrendingUp, Target, ExternalLink, Calendar, Star } from 'lucide-react';
import { Card } from '../../components/ui';

export default function EmployeePerformanceTab({ emp, isRTL, lang }) {
  const [reviews, setReviews] = useState([]);
  const [targets, setTargets] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (!emp?.id) { setLoading(false); return; }
    let cancelled = false;
    Promise.all([
      supabase.from('performance_reviews').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }).limit(5).then(r => r, () => ({ data: [] })),
      supabase.from('kpi_targets').select('*').eq('employee_id', emp.id).eq('month', currentMonth).eq('year', currentYear).then(r => r, () => ({ data: [] })),
      supabase.from('okr_objectives').select('*').eq('owner_id', emp.id).order('created_at', { ascending: false }).limit(5).then(r => r, () => ({ data: [] })),
    ])
      .then(([revRes, tgtRes, okrRes]) => {
        if (cancelled) return;
        setReviews(revRes.data || []);
        setTargets(tgtRes.data || []);
        setObjectives(okrRes.data || []);
      })
      .then(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [emp?.id, currentMonth, currentYear]);

  // Average rating across reviews
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((s, r) => s + (Number(r.overall_rating) || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  if (loading) return <Card className="p-8 text-center text-xs text-content-muted">جاري التحميل...</Card>;

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Reviews summary */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Award size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'تقييمات الأداء' : 'Performance Reviews'}</p>
          </div>
          <Link to="/hr/reviews" className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-1">
            <ExternalLink size={11} />
            {isRTL ? 'الكل' : 'All'}
          </Link>
        </div>
        <div className="px-5 py-4">
          {reviews.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">
              {isRTL ? 'لا يوجد تقييمات بعد' : 'No reviews yet'}
            </p>
          ) : (
            <>
              <div className={`flex items-center justify-between mb-4 pb-3 border-b border-edge dark:border-edge-dark ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-content-muted dark:text-content-muted-dark">
                  {isRTL ? `متوسط ${reviews.length} تقييم` : `Avg of ${reviews.length} review${reviews.length > 1 ? 's' : ''}`}
                </span>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-base font-extrabold text-yellow-600">{avgRating}</span>
                  <span className="text-[10px] text-content-muted dark:text-content-muted-dark">/5</span>
                </div>
              </div>
              {reviews.map(r => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{r.review_period || r.period || '—'}</p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                      {r.review_date} · {r.status || (isRTL ? 'مكتمل' : 'completed')}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-content dark:text-content-dark">{r.overall_rating || '—'}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* KPIs this month */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <TrendingUp size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? `KPIs ${monthName}` : `KPIs · ${monthName}`}
            </p>
          </div>
          <Link to="/hr/performance" className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-1">
            <ExternalLink size={11} />
            {isRTL ? 'التفاصيل' : 'Details'}
          </Link>
        </div>
        <div className="px-5 py-4">
          {targets.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">
              {isRTL ? 'لا توجد أهداف لهذا الشهر' : 'No targets set for this month'}
            </p>
          ) : targets.map(t => (
            <div key={t.id} className={`py-2 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs font-semibold text-content dark:text-content-dark">{t.metric}</span>
                <span className="text-sm font-bold text-brand-500 tabular-nums">
                  {Number(t.actual_value || 0).toLocaleString()} / {Number(t.target_value || 0).toLocaleString()}
                </span>
              </div>
              {t.target_value > 0 && (
                <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-brand-500/10 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((Number(t.actual_value) || 0) / Number(t.target_value)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* OKRs */}
      <Card className="overflow-hidden lg:col-span-2">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Target size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الأهداف (OKRs)' : 'Goals (OKRs)'}</p>
          </div>
          <Link to="/hr/goals" className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-1">
            <ExternalLink size={11} />
            {isRTL ? 'الكل' : 'All'}
          </Link>
        </div>
        <div className="px-5 py-3">
          {objectives.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-4">
              {isRTL ? 'لا توجد أهداف معينة لهذا الموظف' : 'No goals assigned'}
            </p>
          ) : objectives.map(obj => (
            <div key={obj.id} className={`py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                  {(isRTL ? obj.titleAr : obj.title) || obj.title || '—'}
                </p>
                <div className={`flex items-center gap-2 text-[10px] text-content-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Calendar size={11} />
                  {obj.quarter} {obj.year}
                </div>
              </div>
              {obj.description && (
                <p className="m-0 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">{obj.description}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
