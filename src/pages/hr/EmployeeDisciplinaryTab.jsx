import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../../lib/supabase';
import { Shield, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui';

const SEV_COLOR = { high: '#EF4444', medium: '#6B8DB5', low: '#4A7AAB' };
const TYPE_LABELS = {
  warning:     { ar: 'إنذار', en: 'Warning' },
  suspension:  { ar: 'إيقاف', en: 'Suspension' },
  termination: { ar: 'فصل', en: 'Termination' },
};
const SEV_LABELS = {
  high:   { ar: 'عالي', en: 'High' },
  medium: { ar: 'متوسط', en: 'Medium' },
  low:    { ar: 'منخفض', en: 'Low' },
};
const STATUS_LABELS = {
  open:   { ar: 'مفتوح', en: 'Open' },
  closed: { ar: 'مغلق', en: 'Closed' },
};

export default function EmployeeDisciplinaryTab({ emp, isRTL, lang }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!emp?.id) { setLoading(false); return; }
    let cancelled = false;
    // Disciplinary table uses emp_id which can be either UUID or employee_id string
    supabase
      .from('disciplinary')
      .select('*')
      .or(`emp_id.eq.${emp.id},emp_id.eq.${emp.employee_id || emp.id}`)
      .order('date', { ascending: false })
      .then(({ data }) => { if (!cancelled) setCases(data || []); })
      .then(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [emp?.id, emp?.employee_id]);

  if (loading) return <Card className="p-8 text-center text-xs text-content-muted">جاري التحميل...</Card>;

  const open = cases.filter(c => c.status === 'open').length;
  const high = cases.filter(c => c.severity === 'high').length;

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Shield size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'الشؤون التأديبية' : 'Disciplinary Cases'}
          </p>
          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">({cases.length})</span>
        </div>
        <Link to="/hr/disciplinary" className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-1">
          <ExternalLink size={11} />
          {isRTL ? 'إدارة' : 'Manage'}
        </Link>
      </div>

      <div className="px-5 py-3">
        {cases.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 size={26} className="text-green-500 mx-auto mb-2" />
            <p className="m-0 text-xs font-semibold text-content dark:text-content-dark">
              {isRTL ? 'لا يوجد سجل تأديبي' : 'Clean record'}
            </p>
            <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لم يتم تسجيل أي مخالفات لهذا الموظف' : 'No disciplinary cases on file'}
            </p>
          </div>
        ) : (
          <>
            {(open > 0 || high > 0) && (
              <div className={`flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <AlertTriangle size={14} className="text-yellow-600" />
                <p className="m-0 text-[11px] text-content dark:text-content-dark">
                  {isRTL
                    ? `${open} حالة مفتوحة · ${high} خطورة عالية`
                    : `${open} open · ${high} high severity`}
                </p>
              </div>
            )}

            {cases.map(c => {
              const sevColor = SEV_COLOR[c.severity] || '#6B8DB5';
              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-3 py-3 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${sevColor}18` }}>
                    <Shield size={14} style={{ color: sevColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-2 flex-wrap mb-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <p className="m-0 text-xs font-bold text-content dark:text-content-dark">
                        {TYPE_LABELS[c.type]?.[lang] || c.type}
                      </p>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: `${sevColor}18`, color: sevColor, border: `1px solid ${sevColor}35` }}
                      >
                        {SEV_LABELS[c.severity]?.[lang] || c.severity}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: c.status === 'open' ? '#6B8DB518' : '#10B98118',
                          color: c.status === 'open' ? '#6B8DB5' : '#10B981',
                          border: `1px solid ${c.status === 'open' ? '#6B8DB535' : '#10B98135'}`,
                        }}
                      >
                        {STATUS_LABELS[c.status]?.[lang] || c.status}
                      </span>
                    </div>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{c.reason}</p>
                    {c.notes && (
                      <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark italic">{c.notes}</p>
                    )}
                    <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">{c.date}</p>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Card>
  );
}
