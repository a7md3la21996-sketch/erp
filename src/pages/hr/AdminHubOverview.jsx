import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Briefcase, Package, Shield, BookMarked,
  AlertTriangle, CheckCircle2, ChevronRight, Calendar,
  TrendingUp, AlertCircle,
} from 'lucide-react';
import supabase from '../../lib/supabase';
import { Card, KpiCard, PageSkeleton } from '../../components/ui';
import { loadFromSupabase } from '../../utils/supabaseSync';

/* ─────────────────────────────────────────────────────────────────────────
   Admin Hub Overview — first tab when user lands on /hr/admin.
   Mirrors the visual structure used by PayrollOverview.
───────────────────────────────────────────────────────────────────────── */
export default function AdminHubOverview({ isRTL, lang }) {
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [disciplinary, setDisciplinary] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('employee_documents').select('id,name,type,expiry_date,employee_id,created_at').order('created_at', { ascending: false }),
      supabase.from('contracts').select('id,status,end_date,employee_id,contract_type,created_at').order('created_at', { ascending: false }),
      supabase.from('disciplinary').select('id,status,severity,employee_id,created_at').order('created_at', { ascending: false }),
      loadFromSupabase('platform_hr_assets', 'platform_hr_assets'),
    ]).then(([docs, conts, disc, assetsData]) => {
      if (cancelled) return;
      setDocuments(docs?.data || []);
      setContracts(conts?.data || []);
      setDisciplinary(disc?.data || []);
      setAssets(Array.isArray(assetsData) ? assetsData : []);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const docStats = useMemo(() => {
    const today = new Date();
    const in30 = new Date();
    in30.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const in30Str = in30.toISOString().slice(0, 10);
    const expiringSoon = documents.filter(d =>
      d.expiry_date &&
      d.expiry_date >= todayStr &&
      d.expiry_date <= in30Str
    );
    const expired = documents.filter(d => d.expiry_date && d.expiry_date < todayStr);
    return {
      total: documents.length,
      expiringSoon: expiringSoon.length,
      expiringSoonList: expiringSoon.slice(0, 5),
      expired: expired.length,
    };
  }, [documents]);

  const contractStats = useMemo(() => {
    const active = contracts.filter(c => c.status === 'active');
    return {
      activeCount: active.length,
      total: contracts.length,
    };
  }, [contracts]);

  const disciplinaryStats = useMemo(() => {
    const open = disciplinary.filter(c => c.status === 'open');
    const high = open.filter(c => c.severity === 'high');
    return {
      openCount: open.length,
      highCount: high.length,
      total: disciplinary.length,
    };
  }, [disciplinary]);

  const assetStats = useMemo(() => {
    const totalValue = assets.reduce((s, a) => s + (Number(a.value) || 0), 0);
    return {
      total: assets.length,
      totalValue,
    };
  }, [assets]);

  if (loading) return <PageSkeleton hasKpis tableRows={4} />;

  // Status banner
  const status = (docStats.expiringSoon > 0 || disciplinaryStats.openCount > 0)
    ? {
        label_ar: docStats.expiringSoon > 0
          ? `${docStats.expiringSoon} مستند ينتهي خلال 30 يوم`
          : `${disciplinaryStats.openCount} حالة تأديبية مفتوحة`,
        label_en: docStats.expiringSoon > 0
          ? `${docStats.expiringSoon} documents expiring within 30 days`
          : `${disciplinaryStats.openCount} open disciplinary cases`,
        color: '#F59E0B',
        icon: AlertTriangle,
      }
    : { label_ar: 'كل شيء على ما يرام', label_en: 'All clear', color: '#10B981', icon: CheckCircle2 };
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
                {isRTL ? 'حالة السجلات' : 'Records Health'}
              </p>
              <p className="m-0 text-xs" style={{ color: status.color }}>
                {isRTL ? status.label_ar : status.label_en}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link
              to="/hr/admin?tab=documents"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600"
            >
              <FileText size={12} />
              {isRTL ? 'مراجعة المستندات' : 'Review Documents'}
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KpiCard
          icon={FileText}
          label={isRTL ? 'إجمالي المستندات' : 'Total Documents'}
          value={docStats.total}
          sub={docStats.expired > 0 ? `${docStats.expired} ${isRTL ? 'منتهي' : 'expired'}` : (isRTL ? 'سارية' : 'Valid')}
          color="#1B3347"
        />
        <KpiCard
          icon={AlertTriangle}
          label={isRTL ? 'تنتهي قريباً' : 'Expiring Soon'}
          value={docStats.expiringSoon}
          sub={isRTL ? 'خلال 30 يوم' : 'Next 30 days'}
          color="#F59E0B"
        />
        <KpiCard
          icon={Briefcase}
          label={isRTL ? 'عقود نشطة' : 'Active Contracts'}
          value={contractStats.activeCount}
          sub={`${contractStats.total} ${isRTL ? 'إجمالي' : 'total'}`}
          color="#4A7AAB"
        />
        <KpiCard
          icon={Shield}
          label={isRTL ? 'حالات تأديبية' : 'Open Cases'}
          value={disciplinaryStats.openCount}
          sub={disciplinaryStats.highCount > 0 ? `${disciplinaryStats.highCount} ${isRTL ? 'خطورة عالية' : 'high severity'}` : (isRTL ? 'لا حالات حرجة' : 'No critical')}
          color={disciplinaryStats.openCount > 0 ? '#EF4444' : '#10B981'}
        />
      </div>

      {/* Two-col: assets summary + disciplinary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Package size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الأصول' : 'Assets'}</p>
            </div>
            <Link to="/hr/admin?tab=assets" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'القيمة الإجمالية' : 'Total Value'}
              </p>
              <p className="m-0 text-lg font-bold text-brand-500">
                {assetStats.totalValue.toLocaleString()} <span className="text-[10px] font-normal">{isRTL ? 'ج.م' : 'EGP'}</span>
              </p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'عدد الأصول' : 'Asset Count'}
              </p>
              <p className="m-0 text-lg font-bold" style={{ color: '#4A7AAB' }}>
                {assetStats.total}
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Shield size={16} className="text-brand-500" />
              <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'الحالات التأديبية' : 'Disciplinary'}</p>
            </div>
            <Link to="/hr/admin?tab=disciplinary" className="text-[11px] font-semibold text-brand-500 hover:underline">
              {isRTL ? 'إدارة' : 'Manage'}
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'مفتوحة' : 'Open'}
              </p>
              <p className="m-0 text-lg font-bold text-red-500">
                {disciplinaryStats.openCount}
              </p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                {disciplinaryStats.highCount > 0 ? `${disciplinaryStats.highCount} ${isRTL ? 'خطورة عالية' : 'high'}` : (isRTL ? 'لا توجد حرجة' : 'None critical')}
              </p>
            </div>
            <div>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark uppercase tracking-wide">
                {isRTL ? 'إجمالي الحالات' : 'Total Cases'}
              </p>
              <p className="m-0 text-lg font-bold" style={{ color: '#4A7AAB' }}>
                {disciplinaryStats.total}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Expiring documents list */}
      <Card className="overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Calendar size={16} className="text-brand-500" />
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{isRTL ? 'مستندات تنتهي خلال 30 يوم' : 'Documents Expiring Soon'}</p>
          </div>
          <Link to="/hr/admin?tab=documents" className="text-[11px] font-semibold text-brand-500 hover:underline">
            {isRTL ? 'الكل' : 'View All'}
          </Link>
        </div>
        <div className="px-5 py-2">
          {docStats.expiringSoonList.length === 0 ? (
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark text-center py-6">
              {isRTL ? 'لا توجد مستندات تنتهي قريباً' : 'No documents expiring soon'}
            </p>
          ) : docStats.expiringSoonList.map(d => {
            const days = Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000);
            const urgent = days <= 7;
            return (
              <div key={d.id} className={`flex items-center justify-between py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {urgent
                    ? <AlertCircle size={14} className="text-red-500" />
                    : <AlertTriangle size={14} className="text-amber-500" />}
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
                      {d.name || d.type || (isRTL ? 'مستند' : 'Document')}
                    </p>
                    <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">
                      {isRTL ? `ينتهي ${d.expiry_date}` : `Expires ${d.expiry_date}`}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums ${urgent ? 'text-red-500' : 'text-amber-500'}`}>
                  {days} {isRTL ? 'يوم' : days === 1 ? 'day' : 'days'}
                </span>
              </div>
            );
          })}
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
            { to: '/hr/admin?tab=documents',    icon: FileText,   label_ar: 'المستندات',   label_en: 'Documents' },
            { to: '/hr/admin?tab=contracts',    icon: Briefcase,  label_ar: 'العقود',      label_en: 'Contracts' },
            { to: '/hr/admin?tab=assets',       icon: Package,    label_ar: 'الأصول',       label_en: 'Assets' },
            { to: '/hr/admin?tab=policies',     icon: BookMarked, label_ar: 'السياسات',    label_en: 'Policies' },
            { to: '/hr/admin?tab=disciplinary', icon: Shield,     label_ar: 'التأديبية',  label_en: 'Disciplinary' },
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
