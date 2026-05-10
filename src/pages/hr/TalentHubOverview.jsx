import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Users, UserPlus, TrendingUp, CheckCircle2,
  AlertTriangle, ArrowRight, Activity,
} from 'lucide-react';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';
import { fetchOnboardingRecords } from '../../services/onboardingService';

/* ─────────────────────────────────────────────────────────────────────────
   Talent Hub Overview — at-a-glance snapshot of open jobs, new applicants,
   and onboarding progress. Mirrors PayrollOverview / TimeHubOverview.
───────────────────────────────────────────────────────────────────────── */
export default function TalentHubOverview({ isRTL, lang }) {
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [onboarding, setOnboarding] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Open job postings (ats_job_postings) — table may not exist yet
      supabase
        .from('ats_job_postings')
        .select('id, title, title_ar, status, created_at, closing_date')
        .order('created_at', { ascending: false })
        .then(r => r, () => ({ data: [] })),
      // New applicants this month — table may not exist yet
      supabase
        .from('ats_applicants')
        .select('id, name, posting_id, status, created_at')
        .gte('created_at', monthStart)
        .order('created_at', { ascending: false })
        .then(r => r, () => ({ data: [] })),
      // Onboarding records (filtered client-side)
      fetchOnboardingRecords().catch(() => []),
    ]).then(([jobsRes, appsRes, onb]) => {
      if (cancelled) return;
      setJobs(jobsRes?.data || []);
      setApplicants(appsRes?.data || []);
      setOnboarding(onb || []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [monthStart]);

  const openJobs = useMemo(() => jobs.filter(j => j.status === 'open'), [jobs]);
  const inProgressOnboarding = useMemo(
    () => onboarding.filter(o => o.status === 'in_progress'),
    [onboarding],
  );
  const completedOnboarding = useMemo(
    () => onboarding.filter(o => o.status === 'completed'),
    [onboarding],
  );

  // Build a recent activity feed across the three streams
  const activity = useMemo(() => {
    const stream = [];
    jobs.slice(0, 5).forEach(j => {
      stream.push({
        kind: 'job',
        id: `job-${j.id}`,
        date: j.created_at,
        title: isRTL ? (j.title_ar || j.title || '—') : (j.title || j.title_ar || '—'),
        sub: isRTL ? 'وظيفة جديدة' : 'New job posting',
        Icon: Briefcase,
        color: '#4A7AAB',
      });
    });
    applicants.slice(0, 5).forEach(a => {
      stream.push({
        kind: 'applicant',
        id: `app-${a.id}`,
        date: a.created_at,
        title: a.name || (isRTL ? 'متقدم جديد' : 'New applicant'),
        sub: isRTL ? 'تقدّم جديد' : 'New application',
        Icon: Users,
        color: '#10B981',
      });
    });
    onboarding.slice(0, 5).forEach(o => {
      const empName = isRTL
        ? (o.employee?.full_name_ar || o.employee?.full_name_en || '—')
        : (o.employee?.full_name_en || o.employee?.full_name_ar || '—');
      stream.push({
        kind: 'onboarding',
        id: `onb-${o.id}`,
        date: o.start_date || o.created_at,
        title: empName,
        sub: o.status === 'completed'
          ? (isRTL ? 'استقبال مكتمل' : 'Onboarding complete')
          : (isRTL ? 'قيد الاستقبال' : 'Onboarding in progress'),
        Icon: o.status === 'completed' ? CheckCircle2 : UserPlus,
        color: o.status === 'completed' ? '#10B981' : '#F59E0B',
      });
    });
    return stream
      .filter(item => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [jobs, applicants, onboarding, isRTL]);

  if (loading) return <PageSkeleton hasKpis tableRows={4} />;

  // Pipeline status card
  const pipelineState = openJobs.length === 0
    ? { label_ar: 'لا توجد وظائف مفتوحة', label_en: 'No open positions', color: '#94A3B8', icon: AlertTriangle }
    : applicants.length === 0
      ? { label_ar: 'في انتظار المتقدمين', label_en: 'Awaiting applicants', color: '#F59E0B', icon: AlertTriangle }
      : { label_ar: 'نشط', label_en: 'Active Pipeline', color: '#10B981', icon: TrendingUp };
  const StatusIcon = pipelineState.icon;

  const monthName = now.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Pipeline status */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${pipelineState.color}18` }}
            >
              <StatusIcon size={20} style={{ color: pipelineState.color }} />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? `خط التوظيف · ${monthName}` : `Talent pipeline · ${monthName}`}
              </p>
              <p className="m-0 text-xs" style={{ color: pipelineState.color }}>
                {isRTL ? pipelineState.label_ar : pipelineState.label_en}
                {openJobs.length > 0 && ` · ${openJobs.length} ${isRTL ? 'وظيفة مفتوحة' : 'open'}`}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              to="/hr/talent?tab=ats"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600"
            >
              <Briefcase size={12} />
              {isRTL ? 'فتح المتقدمين' : 'Open ATS'}
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          icon={Briefcase}
          label={isRTL ? 'وظائف مفتوحة' : 'Open Jobs'}
          value={openJobs.length}
          sub={jobs.length > openJobs.length ? `${jobs.length} ${isRTL ? 'إجمالي' : 'total'}` : ''}
          color="#4A7AAB"
        />
        <KpiCard
          icon={Users}
          label={isRTL ? 'متقدمون هذا الشهر' : 'Applicants (Month)'}
          value={applicants.length}
          color="#10B981"
        />
        <KpiCard
          icon={UserPlus}
          label={isRTL ? 'استقبال جارٍ' : 'In-Progress Onboarding'}
          value={inProgressOnboarding.length}
          color="#F59E0B"
        />
        <KpiCard
          icon={CheckCircle2}
          label={isRTL ? 'استقبال مكتمل' : 'Completed Onboarding'}
          value={completedOnboarding.length}
          color="#1B3347"
        />
      </div>

      {/* Two-col: open jobs + onboarding-in-progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Open job postings */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Briefcase size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'الوظائف المفتوحة' : 'Open Postings'}
              </p>
            </div>
            <Link to="/hr/talent?tab=recruitment" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-2">
            {openJobs.length === 0 ? (
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
                {isRTL ? 'لا توجد وظائف مفتوحة حالياً' : 'No open job postings'}
              </p>
            ) : openJobs.slice(0, 5).map(j => {
              const applicantsForJob = applicants.filter(a => a.posting_id === j.id).length;
              return (
                <div
                  key={j.id}
                  className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Briefcase size={14} className="text-brand-500" />
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                        {isRTL ? (j.title_ar || j.title || '—') : (j.title || j.title_ar || '—')}
                      </p>
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                        {j.created_at?.slice(0, 10)}
                        {j.closing_date && ` · ${isRTL ? 'يُغلق' : 'closes'} ${j.closing_date.slice(0, 10)}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500">
                    {applicantsForJob} {isRTL ? 'متقدم' : 'apps'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Onboarding in progress */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <UserPlus size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? 'استقبال جارٍ' : 'Onboarding In Progress'}
              </p>
            </div>
            <Link to="/hr/talent?tab=onboarding" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-2">
            {inProgressOnboarding.length === 0 ? (
              <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
                {isRTL ? 'لا توجد عمليات استقبال جارية' : 'No onboarding in progress'}
              </p>
            ) : inProgressOnboarding.slice(0, 5).map(o => {
              const checklist = o.checklist || {};
              const total = Object.keys(checklist).length || 1;
              const done = Object.values(checklist).filter(Boolean).length;
              const pct = Math.round((done / total) * 100);
              const empName = isRTL
                ? (o.employee?.full_name_ar || o.employee?.full_name_en || '—')
                : (o.employee?.full_name_en || o.employee?.full_name_ar || '—');
              return (
                <div
                  key={o.id}
                  className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <UserPlus size={14} className="text-amber-500" />
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{empName}</p>
                      <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                        {o.start_date?.slice(0, 10) || '—'} · {done}/{total} {isRTL ? 'بنود' : 'items'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 tabular-nums">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent activity feed */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Activity size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
              {isRTL ? 'النشاط الأخير' : 'Recent Activity'}
            </p>
          </div>
        </div>
        <div className="px-5 py-2">
          {activity.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
              {isRTL ? 'لا يوجد نشاط' : 'No recent activity'}
            </p>
          ) : activity.map(item => {
            const Icon = item.Icon;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Icon size={14} style={{ color: item.color }} />
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{item.title}</p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{item.sub}</p>
                  </div>
                </div>
                <span className="text-[10px] text-content-muted dark:text-content-muted-dark">
                  {item.date?.slice(0, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to="/hr/talent?tab=recruitment"
          className={`flex items-center justify-between p-3 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Users size={16} className="text-brand-500" />
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
              {isRTL ? 'إدارة الوظائف' : 'Manage Jobs'}
            </p>
          </div>
          <ArrowRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <Link
          to="/hr/talent?tab=ats"
          className={`flex items-center justify-between p-3 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Briefcase size={16} className="text-brand-500" />
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
              {isRTL ? 'متابعة المتقدمين' : 'Track Applicants'}
            </p>
          </div>
          <ArrowRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <Link
          to="/hr/talent?tab=onboarding"
          className={`flex items-center justify-between p-3 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <UserPlus size={16} className="text-brand-500" />
            <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
              {isRTL ? 'استقبال الموظفين' : 'Onboarding'}
            </p>
          </div>
          <ArrowRight size={14} className={`text-content-muted dark:text-content-muted-dark ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
      </div>
    </div>
  );
}
