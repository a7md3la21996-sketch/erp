import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPayrollRun, fetchPayrollRuns, fetchActiveLoans, fetchAdjustments,
} from '../../services/payrollService';
import {
  DollarSign, Calendar, CreditCard, Plus, Settings, Receipt,
  Archive, ChevronRight, Lock, AlertTriangle, CheckCircle2,
  Play, FileText, TrendingUp, Clock,
} from 'lucide-react';
import { Card, KpiCard, Button, PageSkeleton } from '../../components/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Payroll Hub — single entry point that consolidates everything related to
   monthly compensation. Reduces sidebar clutter from 6 separate pages
   (Payroll, Run, Rules, Loans, Bonuses, Expenses) to a single hub with
   sub-navigation.
───────────────────────────────────────────────────────────────────────── */

// Lazy-load existing pages so we don't pay their cost when on Overview
const PayrollPage      = lazy(() => import('./PayrollPage'));
const PayrollClose     = lazy(() => import('./PayrollClose'));
const LoansPage        = lazy(() => import('./LoansPage'));
const BonusesPage      = lazy(() => import('./BonusesPage'));
const PayrollRulesPage = lazy(() => import('./PayrollRulesPage'));
const ExpenseClaimsPage = lazy(() => import('./ExpenseClaimsPage'));

const TABS = [
  { key: 'overview',   icon: TrendingUp, label_ar: 'نظرة عامة',     label_en: 'Overview' },
  { key: 'close',      icon: Lock,       label_ar: 'إقفال الشهر',   label_en: 'Close Month' },
  { key: 'table',      icon: DollarSign, label_ar: 'جدول الشهر',    label_en: 'Monthly Table' },
  { key: 'loans',      icon: CreditCard, label_ar: 'القروض',        label_en: 'Loans' },
  { key: 'bonuses',    icon: Plus,       label_ar: 'البونص والخصومات', label_en: 'Bonuses & Penalties' },
  { key: 'expenses',   icon: Receipt,    label_ar: 'المصروفات',     label_en: 'Expense Claims' },
  { key: 'history',    icon: Archive,    label_ar: 'الأرشيف',        label_en: 'Run History' },
  { key: 'rules',      icon: Settings,   label_ar: 'الإعدادات',      label_en: 'Rules & Config' },
];

export default function PayrollHubPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  if (profile && !['admin', 'operations', 'finance', 'hr'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg font-bold text-content dark:text-content-dark">
          {isRTL ? 'غير مصرح' : 'Unauthorized'}
        </p>
      </div>
    );
  }

  // Tab is encoded as query param (?tab=loans) so the hub URL stays /hr/payroll
  const params = new URLSearchParams(location.search);
  const activeTab = TABS.find(t => t.key === params.get('tab'))?.key || 'overview';

  const setTab = (key) => {
    if (key === 'overview') navigate('/hr/payroll');
    else navigate(`/hr/payroll?tab=${key}`);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <DollarSign size={22} className="text-brand-500" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {isRTL ? 'مركز المرتبات' : 'Payroll'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'كل ما يخص المرتبات والقروض والبدلات في مكان واحد' : 'One place for compensation, loans, bonuses & expenses'}
            </p>
          </div>
        </div>
        <Link
          to="/hr/payroll/run"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
        >
          <Play size={14} />
          {isRTL ? 'تشغيل المرتبات' : 'Run Payroll'}
        </Link>
      </div>

      {/* Tab nav */}
      <div className={`flex gap-1 mb-5 p-1 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-brand-500 text-white'
                  : 'text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500'
              }`}
            >
              <Icon size={14} />
              {isRTL ? tab.label_ar : tab.label_en}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <Suspense fallback={<div className="px-4 py-4"><PageSkeleton hasKpis tableRows={6} /></div>}>
        {activeTab === 'overview' && <PayrollOverview profile={profile} isRTL={isRTL} lang={lang} />}
        {activeTab === 'close'    && <PayrollClose />}
        {activeTab === 'table'    && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><PayrollPage /></div>}
        {activeTab === 'loans'    && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><LoansPage /></div>}
        {activeTab === 'bonuses'  && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><BonusesPage /></div>}
        {activeTab === 'expenses' && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><ExpenseClaimsPage /></div>}
        {activeTab === 'rules'    && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><PayrollRulesPage /></div>}
        {activeTab === 'history'  && <PayrollHistory isRTL={isRTL} lang={lang} />}
      </Suspense>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Overview tab — the cohesive dashboard the user gets first.
───────────────────────────────────────────────────────────────────────── */
function PayrollOverview({ profile, isRTL, lang }) {
  const [currentRun, setCurrentRun] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = new Date(year, month - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchPayrollRun(month, year),
      fetchPayrollRuns(),
      fetchActiveLoans(),
      fetchAdjustments(month, year),
    ]).then(([curr, runs, loans, adjs]) => {
      if (cancelled) return;
      setCurrentRun(curr);
      setRecentRuns((runs || []).slice(0, 5));
      setActiveLoans(loans || []);
      setAdjustments(adjs || []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [month, year]);

  const loanStats = useMemo(() => ({
    count: activeLoans.length,
    monthlyTotal: activeLoans.reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0),
    outstanding: activeLoans.reduce((s, l) => s + Math.max(0, (Number(l.amount) || 0) - (Number(l.balance_paid) || 0)), 0),
  }), [activeLoans]);

  const adjStats = useMemo(() => {
    const bonuses = adjustments.filter(a => ['addition', 'bonus', 'commission'].includes(a.type));
    const penalties = adjustments.filter(a => ['deduction', 'penalty'].includes(a.type));
    return {
      bonusCount: bonuses.length,
      bonusTotal: bonuses.reduce((s, a) => s + (Number(a.amount) || 0), 0),
      penaltyCount: penalties.length,
      penaltyTotal: penalties.reduce((s, a) => s + (Number(a.amount) || 0), 0),
    };
  }, [adjustments]);

  if (loading) return <PageSkeleton hasKpis tableRows={4} />;

  // Status of this month's run
  const status = currentRun?.locked_at
    ? { label_ar: 'مُغلق', label_en: 'Locked', color: '#1B3347', icon: Lock }
    : currentRun
      ? { label_ar: 'مُشغّل', label_en: 'Run', color: '#10B981', icon: CheckCircle2 }
      : { label_ar: 'لم يُشغّل بعد', label_en: 'Not Run Yet', color: '#F59E0B', icon: AlertTriangle };
  const StatusIcon = status.icon;

  return (
    <div className="space-y-5">
      {/* This month status */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${status.color}18` }}>
              <StatusIcon size={20} style={{ color: status.color }} />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? `مرتبات ${monthName}` : `${monthName} payroll`}
              </p>
              <p className="m-0 text-xs" style={{ color: status.color }}>
                {isRTL ? status.label_ar : status.label_en}
                {currentRun?.version > 1 && ` · ${isRTL ? `الإصدار ${currentRun.version}` : `v${currentRun.version}`}`}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              to="/hr/payroll/run"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600"
            >
              <Play size={12} />
              {currentRun ? (isRTL ? 'تشغيل مجدداً' : 'Re-run') : (isRTL ? 'تشغيل' : 'Run')}
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          icon={DollarSign}
          label={isRTL ? 'الموظفين' : 'Employees'}
          value={currentRun?.total_employees || '—'}
          color="#1B3347"
        />
        <KpiCard
          icon={TrendingUp}
          label={isRTL ? 'الإجمالي' : 'Gross'}
          value={currentRun ? `${Math.round((Number(currentRun.total_gross) || 0) / 1000)}k` : '—'}
          sub={currentRun ? (isRTL ? 'ج.م' : 'EGP') : ''}
          color="#4A7AAB"
        />
        <KpiCard
          icon={DollarSign}
          label={isRTL ? 'الصافي' : 'Net'}
          value={currentRun ? `${Math.round((Number(currentRun.total_net) || 0) / 1000)}k` : '—'}
          sub={currentRun ? (isRTL ? 'ج.م' : 'EGP') : ''}
          color="#10B981"
        />
        <KpiCard
          icon={CreditCard}
          label={isRTL ? 'قروض نشطة' : 'Active Loans'}
          value={loanStats.count}
          sub={loanStats.monthlyTotal > 0 ? `${loanStats.monthlyTotal.toLocaleString()} ج.م/${isRTL ? 'شهر' : 'mo'}` : ''}
          color="#F59E0B"
        />
      </div>

      {/* Two-col: This month details + Active items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* This month adjustments */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Plus size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                {isRTL ? `تعديلات ${monthName}` : `${monthName} Adjustments`}
              </p>
            </div>
            <Link to="/hr/payroll?tab=bonuses" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'بونص' : 'Bonuses'}
              </p>
              <p className="m-0 text-lg font-bold text-green-500">
                +{adjStats.bonusTotal.toLocaleString()} <span className="text-[10px] font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{adjStats.bonusCount} {isRTL ? 'سجل' : 'entries'}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'خصومات' : 'Penalties'}
              </p>
              <p className="m-0 text-lg font-bold text-red-500">
                -{adjStats.penaltyTotal.toLocaleString()} <span className="text-[10px] font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{adjStats.penaltyCount} {isRTL ? 'سجل' : 'entries'}</p>
            </div>
          </div>
        </Card>

        {/* Active loans */}
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CreditCard size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'القروض النشطة' : 'Active Loans'}</p>
            </div>
            <Link to="/hr/payroll?tab=loans" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'إجمالي متبقي' : 'Outstanding'}
              </p>
              <p className="m-0 text-lg font-bold text-brand-500">
                {loanStats.outstanding.toLocaleString()} <span className="text-[10px] font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'خصم شهري' : 'Monthly'}
              </p>
              <p className="m-0 text-lg font-bold text-red-500">
                -{loanStats.monthlyTotal.toLocaleString()} <span className="text-[10px] font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent runs */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Archive size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'آخر التشغيلات' : 'Recent Runs'}</p>
          </div>
          <Link to="/hr/payroll?tab=history" className="text-[11px] font-semibold text-brand-500 hover:underline">
            {isRTL ? 'الكل' : 'View All'}
          </Link>
        </div>
        <div className="px-5 py-2">
          {recentRuns.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
              {isRTL ? 'لم يتم تشغيل المرتبات بعد' : 'No payroll runs yet'}
            </p>
          ) : recentRuns.map(r => {
            const mn = new Date(r.year, r.month - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
            return (
              <div key={r.id} className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {r.locked_at
                    ? <Lock size={14} className="text-brand-500" />
                    : <CheckCircle2 size={14} className="text-green-500" />}
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">{mn}</p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                      {r.total_employees} {isRTL ? 'موظف' : 'emp'} · {r.run_date?.slice(0, 10)}
                      {r.version > 1 && ` · v${r.version}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-brand-500 tabular-nums">
                  {Number(r.total_net || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   History tab — full list of past runs with status + action.
───────────────────────────────────────────────────────────────────────── */
function PayrollHistory({ isRTL, lang }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPayrollRuns()
      .then(d => { if (!cancelled) setRuns(d || []); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageSkeleton hasKpis={false} tableRows={6} />;

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Archive size={16} className="text-brand-500" />
        <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'سجل التشغيلات' : 'Run History'}</p>
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark">({runs.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-bg dark:bg-surface-bg-dark">
            <tr>
              {[
                isRTL ? 'الشهر' : 'Month',
                isRTL ? 'موظفين' : 'Employees',
                isRTL ? 'الإجمالي' : 'Gross',
                isRTL ? 'الخصومات' : 'Deductions',
                isRTL ? 'الصافي' : 'Net',
                isRTL ? 'الحالة' : 'Status',
                isRTL ? 'تاريخ التشغيل' : 'Run Date',
              ].map((h, i) => (
                <th key={i} className={`px-4 py-2 text-[11px] font-semibold text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'لا يوجد سجل تشغيلات' : 'No payroll runs yet'}
              </td></tr>
            ) : runs.map(r => {
              const mn = new Date(r.year, r.month - 1).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
              return (
                <tr key={r.id} className="border-t border-edge/50 dark:border-edge-dark/50 hover:bg-brand-500/5">
                  <td className={`px-4 py-2.5 font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                    {mn}{r.version > 1 && <span className="ml-1 text-[10px] text-content-muted">v{r.version}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>{r.total_employees}</td>
                  <td className={`px-4 py-2.5 tabular-nums ${isRTL ? 'text-right' : 'text-left'}`}>{Number(r.total_gross || 0).toLocaleString()}</td>
                  <td className={`px-4 py-2.5 tabular-nums text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>-{Number(r.total_deductions || 0).toLocaleString()}</td>
                  <td className={`px-4 py-2.5 tabular-nums font-bold text-brand-500 ${isRTL ? 'text-right' : 'text-left'}`}>{Number(r.total_net || 0).toLocaleString()}</td>
                  <td className={`px-4 py-2.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {r.locked_at
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/15 text-brand-500"><Lock size={10} />{isRTL ? 'مُغلق' : 'Locked'}</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-600"><CheckCircle2 size={10} />{isRTL ? 'مُشغّل' : 'Run'}</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-[11px] text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`}>
                    {r.run_date?.slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
