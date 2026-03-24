import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { Shield, AlertTriangle, XCircle, CheckCircle2, Plus, ShieldAlert } from 'lucide-react';
import { Button, Card, KpiCard, Table, Th, Tr, Td, PageSkeleton, ExportButton, SmartFilter, applySmartFilters, Pagination } from '../../components/ui';


const STORAGE_KEY = 'platform_hr_disciplinary';
const DEFAULT_CASES = [
  { id:1, emp_id:'EMP-001', type:'warning', reason:'تأخير متكرر', date:'2026-02-10', status:'open', severity:'low' },
  { id:2, emp_id:'EMP-002', type:'suspension', reason:'غياب بدون إذن', date:'2026-01-20', status:'closed', severity:'high' },
  { id:3, emp_id:'EMP-003', type:'warning', reason:'سلوك غير لائق', date:'2026-03-01', status:'open', severity:'medium' },
  { id:4, emp_id:'EMP-004', type:'termination', reason:'خرق سياسة الشركة', date:'2026-02-28', status:'closed', severity:'high' },
];

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CASES));
  return [...DEFAULT_CASES];
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/* ─── Dynamic Badge ─── */
function DynBadge({ label, color = '#4A7AAB' }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

export default function DisciplinaryPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [cases, setCases] = useState(loadData);

  // Persist to localStorage whenever cases change
  useEffect(() => { saveData(cases); }, [cases]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchEmployees().then(data => { setEmployees(data); setLoading(false); }); }, []);

  const { auditFields, applyAuditFilters } = useAuditFilter('disciplinary');

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'type', label: 'النوع', labelEn: 'Type', type: 'select',
      options: [
        { value: 'warning', label: 'إنذار', labelEn: 'Warning' },
        { value: 'suspension', label: 'إيقاف', labelEn: 'Suspension' },
        { value: 'termination', label: 'فصل', labelEn: 'Termination' },
      ],
    },
    {
      id: 'severity', label: 'الخطورة', labelEn: 'Severity', type: 'select',
      options: [
        { value: 'high', label: 'عالي', labelEn: 'High' },
        { value: 'medium', label: 'متوسط', labelEn: 'Medium' },
        { value: 'low', label: 'منخفض', labelEn: 'Low' },
      ],
    },
    {
      id: 'status', label: 'الحالة', labelEn: 'Status', type: 'select',
      options: [
        { value: 'open', label: 'مفتوح', labelEn: 'Open' },
        { value: 'closed', label: 'مغلق', labelEn: 'Closed' },
      ],
    },
    { id: 'date', label: 'التاريخ', labelEn: 'Date', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = cases;

    // Apply smart filters
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => {
        const emp = employees.find(e => e.employee_id === c.emp_id || e.id === c.emp_id);
        const name = emp ? ((isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar) : c.emp_id;
        return name.toLowerCase().includes(q) || (c.reason || '').toLowerCase().includes(q) || (c.emp_id || '').toLowerCase().includes(q);
      });
    }

    return result;
  }, [cases, smartFilters, SMART_FIELDS, search, employees, isRTL]);

  const open   = filtered.filter(c=>c.status==='open').length;
  const closed = filtered.filter(c=>c.status==='closed').length;
  const high   = filtered.filter(c=>c.severity==='high').length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, smartFilters]);

  const severityColor = s => s==='high'?'#EF4444':s==='medium'?'#6B8DB5':'#4A7AAB';
  const severityLabel = (s,lang) => ({ high:lang==='ar'?'عالي':'High', medium:lang==='ar'?'متوسط':'Medium', low:lang==='ar'?'منخفض':'Low' }[s]||s);
  const typeLabel     = (t,lang) => ({ warning:lang==='ar'?'إنذار':'Warning', suspension:lang==='ar'?'إيقاف':'Suspension', termination:lang==='ar'?'فصل':'Termination' }[t]||t);
  const statusLabel   = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis kpiCount={4} tableRows={4} tableCols={6} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Shield size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'الشؤون التأديبية':'Disciplinary'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة الحالات التأديبية':'Manage disciplinary cases'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={cases}
            filename={isRTL ? 'الشؤون_التأديبية' : 'disciplinary'}
            title={isRTL ? 'الشؤون التأديبية' : 'Disciplinary Cases'}
            columns={[
              { header: isRTL ? 'رقم الموظف' : 'Employee ID', key: 'emp_id' },
              { header: isRTL ? 'النوع' : 'Type', key: r => typeLabel(r.type, lang) },
              { header: isRTL ? 'السبب' : 'Reason', key: 'reason' },
              { header: isRTL ? 'التاريخ' : 'Date', key: 'date' },
              { header: isRTL ? 'الخطورة' : 'Severity', key: r => severityLabel(r.severity, lang) },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
            ]}
          />
          <Button size="md">
            <Plus size={16} />{lang==='ar'?'+ حالة جديدة':'+ New Case'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Shield}       label={lang==='ar'?'إجمالي الحالات':'Total Cases'} value={filtered.length} color="#1B3347" />
        <KpiCard icon={AlertTriangle} label={lang==='ar'?'مفتوحة':'Open'}           value={open}         color="#6B8DB5" />
        <KpiCard icon={XCircle}      label={lang==='ar'?'خطورة عالية':'High Severity'} value={high}         color="#EF4444" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مغلقة':'Closed'}          value={closed}       color="#4A7AAB" />
      </div>

      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
      />

      <Card className="!rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'سجل الحالات':'Cases Log'}</p>
        </div>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الموظف':'Employee', lang==='ar'?'النوع':'Type', lang==='ar'?'السبب':'Reason', lang==='ar'?'التاريخ':'Date', lang==='ar'?'الخطورة':'Severity', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <ShieldAlert size={24} color="#4A7AAB" />
                    </div>
                    <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد مخالفات تأديبية':'No Disciplinary Records'}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تسجيل أي مخالفات':'No disciplinary records found'}</p>
                  </div>
                </td>
              </tr>
            ) : paged.map(cas => {
              const emp = employees.find(e=>e.employee_id===cas.emp_id||e.id===cas.emp_id);
              const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : cas.emp_id;
              return (
                <Tr key={cas.id}>
                  <Td className="font-semibold">{name}</Td>
                  <Td><DynBadge label={typeLabel(cas.type,lang)} color="#4A7AAB" /></Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.reason}</Td>
                  <Td className="text-content-muted dark:text-content-muted-dark">{cas.date}</Td>
                  <Td><DynBadge label={severityLabel(cas.severity,lang)} color={severityColor(cas.severity)} /></Td>
                  <Td><DynBadge label={statusLabel(cas.status,lang)} color={cas.status==='open'?'#6B8DB5':'#4A7AAB'} /></Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
      </Card>
    </div>
  );
}
