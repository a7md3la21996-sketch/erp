import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Star, BookOpen, TrendingUp, Target,
  ChevronRight, ListChecks, GraduationCap,
} from 'lucide-react';
import supabase from '../../lib/supabase';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Development Hub Overview — first tab when user lands on /hr/development.
   Mirrors the visual structure used by PayrollOverview.
───────────────────────────────────────────────────────────────────────── */
export default function DevelopmentHubOverview({ isRTL, lang }) {
  const [reviews, setReviews] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [training, setTraining] = useState([]);
  const [loading, setLoading] = useState(true);

  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('performance_reviews').select('id,status,overall_rating,year,created_at,employee_id').order('created_at', { ascending: false }).then(r => r, () => ({ data: [] })),
      supabase.from('competencies').select('id,key,name_ar,name_en,created_at').then(r => r, () => ({ data: [] })),
      supabase.from('training').select('id,title_ar,title_en,status,created_at').order('created_at', { ascending: false }).then(r => r, () => ({ data: [] })),
    ]).then(([rev, comp, tr]) => {
      if (cancelled) return;
      setReviews(rev?.data || []);
      setCompetencies(comp?.data || []);
      setTraining(tr?.data || []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const reviewStats = useMemo(() => {
    const active = reviews.filter(r => ['draft', 'in_progress', 'submitted'].includes(r.status));
    const completedThisYear = reviews.filter(r => r.status === 'approved' && r.year === year);
    const avgRating = completedThisYear.length
      ? (completedThisYear.reduce((s, r) => s + (Number(r.overall_rating) || 0), 0) / completedThisYear.length).toFixed(1)
      : null;
    return {
      activeCount: active.length,
      completedCount: completedThisYear.length,
      avgRating,
      total: reviews.length,
    };
  }, [reviews, year]);

  const trainingStats = useMemo(() => {
    const active = training.filter(t => t.status === 'active');
    const upcoming = training.filter(t => t.status === 'upcoming');
    const completed = training.filter(t => t.status === 'completed');
    return {
      activeCount: active.length,
      upcomingCount: upcoming.length,
      completedCount: completed.length,
      total: training.length,
    };
  }, [training]);

  const recentReviews = useMemo(() => reviews.slice(0, 5), [reviews]);

  if (loading) return <PageSkeleton hasKpis tableRows={4} />;

  // Status card (overall dev pipeline health)
  const status = reviewStats.activeCount > 0
    ? { label_ar: `${reviewStats.activeCount} تقييم قيد التنفيذ`, label_en: `${reviewStats.activeCount} reviews in progress`, color: '#F59E0B', icon: ListChecks }
    : reviewStats.completedCount > 0
      ? { label_ar: `${reviewStats.completedCount} تقييم مكتمل لهذا العام`, label_en: `${reviewStats.completedCount} reviews completed this year`, color: '#10B981', icon: Award }
      : { label_ar: 'لا توجد تقييمات بعد', label_en: 'No reviews yet', color: '#6B7280', icon: Award };
  const StatusIcon = status.icon;

  return (
    <div className="space-y-5">
      {/* Status card */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${status.color}18` }}>
              <StatusIcon size={20} style={{ color: status.color }} />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? `سنة ${year}` : `${year} performance cycle`}
              </p>
              <p className="m-0 text-xs" style={{ color: status.color }}>
                {isRTL ? status.label_ar : status.label_en}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              to="/hr/development?tab=reviews"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600"
            >
              <Award size={12} />
              {isRTL ? 'إدارة التقييمات' : 'Manage Reviews'}
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          icon={ListChecks}
          label={isRTL ? 'تقييمات نشطة' : 'Active Reviews'}
          value={reviewStats.activeCount}
          sub={isRTL ? 'قيد التنفيذ' : 'In progress'}
          color="#F59E0B"
        />
        <KpiCard
          icon={Star}
          label={isRTL ? 'متوسط التقييم' : 'Avg. Rating'}
          value={reviewStats.avgRating ?? '—'}
          sub={reviewStats.avgRating ? `${reviewStats.completedCount} ${isRTL ? 'مكتمل' : 'completed'}` : (isRTL ? 'لا بيانات' : 'No data')}
          color="#10B981"
        />
        <KpiCard
          icon={Target}
          label={isRTL ? 'الكفاءات' : 'Competencies'}
          value={competencies.length}
          sub={isRTL ? 'نشطة' : 'Active'}
          color="#1B3347"
        />
        <KpiCard
          icon={BookOpen}
          label={isRTL ? 'برامج تدريب' : 'Training Programs'}
          value={trainingStats.activeCount}
          sub={trainingStats.upcomingCount > 0 ? `+${trainingStats.upcomingCount} ${isRTL ? 'قادم' : 'upcoming'}` : (isRTL ? 'نشطة' : 'Active')}
          color="#4A7AAB"
        />
      </div>

      {/* Two-col: training breakdown + competencies pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <BookOpen size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'تدريب' : 'Training'}
              </p>
            </div>
            <Link to="/hr/development?tab=training" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-3">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'نشطة' : 'Active'}
              </p>
              <p className="m-0 text-lg font-bold text-brand-500">{trainingStats.activeCount}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'قادمة' : 'Upcoming'}
              </p>
              <p className="m-0 text-lg font-bold" style={{ color: '#F59E0B' }}>{trainingStats.upcomingCount}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'مكتملة' : 'Completed'}
              </p>
              <p className="m-0 text-lg font-bold text-green-500">{trainingStats.completedCount}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Target size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'الكفاءات' : 'Competencies'}
              </p>
            </div>
            <Link to="/hr/development?tab=competencies" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'كفاءات نشطة' : 'Active'}
              </p>
              <p className="m-0 text-lg font-bold text-brand-500">{competencies.length}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'إجمالي تقييمات' : 'Total Reviews'}
              </p>
              <p className="m-0 text-lg font-bold" style={{ color: '#4A7AAB' }}>{reviewStats.total}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent reviews */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Award size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'آخر التقييمات' : 'Recent Reviews'}</p>
          </div>
          <Link to="/hr/development?tab=reviews" className="text-[11px] font-semibold text-brand-500 hover:underline">
            {isRTL ? 'الكل' : 'View All'}
          </Link>
        </div>
        <div className="px-5 py-2">
          {recentReviews.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
              {isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
            </p>
          ) : recentReviews.map(r => (
            <div key={r.id} className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Award size={14} className={r.status === 'approved' ? 'text-green-500' : 'text-amber-500'} />
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                    {r.period || '—'} · {r.year || '—'}
                  </p>
                  <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                    {r.status === 'approved'
                      ? (isRTL ? 'معتمد' : 'Approved')
                      : r.status === 'submitted'
                        ? (isRTL ? 'مُقدّم' : 'Submitted')
                        : (isRTL ? 'مسودة' : 'Draft')}
                    {r.created_at && ` · ${r.created_at.slice(0, 10)}`}
                  </p>
                </div>
              </div>
              {r.overall_rating != null && (
                <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${isRTL ? 'flex-row-reverse' : ''}`} style={{ color: '#F59E0B' }}>
                  <Star size={12} fill="#F59E0B" />
                  {Number(r.overall_rating).toFixed(1)}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Quick links */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <TrendingUp size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'روابط سريعة' : 'Quick Links'}</p>
        </div>
        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { to: '/hr/development?tab=reviews',      icon: Award,         label_ar: 'تقييم الأداء',  label_en: 'Performance Reviews' },
            { to: '/hr/development?tab=competencies', icon: Target,        label_ar: 'الكفاءات',       label_en: 'Competencies' },
            { to: '/hr/development?tab=training',     icon: GraduationCap, label_ar: 'التدريب',        label_en: 'Training Programs' },
          ].map(link => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark hover:bg-brand-500/5 hover:border-brand-500/40 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <Icon size={14} className="text-brand-500" />
                <span className="flex-1 text-xs font-semibold text-content dark:text-content-dark">
                  {isRTL ? link.label_ar : link.label_en}
                </span>
                <ChevronRight size={12} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
