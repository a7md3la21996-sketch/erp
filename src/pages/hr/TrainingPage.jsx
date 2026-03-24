import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, CheckCircle2, Clock, Plus, GraduationCap } from 'lucide-react';
import { KpiCard, Badge, Button, Card, CardHeader, Table, Th, Td, Tr, ExportButton, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';

const STORAGE_KEY = 'platform_hr_training';
const DEFAULT_PROGRAMS = [
  { id:1, title:'مهارات التفاوض', title_en:'Negotiation Skills', category:'sales', duration:16, enrolled:6, completed:4, status:'active', start:'2026-03-10' },
  { id:2, title:'خدمة العملاء', title_en:'Customer Service', category:'crm', duration:8, enrolled:8, completed:8, status:'completed', start:'2026-02-01' },
  { id:3, title:'إدارة العقارات', title_en:'Property Management', category:'real_estate', duration:24, enrolled:5, completed:2, status:'active', start:'2026-03-15' },
  { id:4, title:'التسويق الرقمي', title_en:'Digital Marketing', category:'marketing', duration:12, enrolled:4, completed:0, status:'upcoming', start:'2026-04-01' },
];

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROGRAMS));
  return [...DEFAULT_PROGRAMS];
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function TrainingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [programs, setPrograms] = useState(loadData);

  // Persist to localStorage whenever programs change
  useEffect(() => { saveData(programs); }, [programs]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  const { auditFields, applyAuditFilters } = useAuditFilter('training');

  const SMART_FIELDS = useMemo(() => [
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = programs;
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [programs, smartFilters, SMART_FIELDS]);

  const active    = filtered.filter(p=>p.status==='active').length;
  const totalEnr  = filtered.reduce((s,p)=>s+p.enrolled,0);
  const totalComp = filtered.reduce((s,p)=>s+p.completed,0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const statusColor = s => s==='completed'?'#4A7AAB':s==='active'?'#6B8DB5':'#8BA8C8';
  const statusLabel = (s,lang) => ({ active:lang==='ar'?'نشط':'Active', completed:lang==='ar'?'مكتمل':'Completed', upcoming:lang==='ar'?'قادم':'Upcoming' }[s]||s);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <BookOpen size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'التدريب والتطوير':'Training & Development'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'برامج تطوير الكفاءات':'Skills development programs'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'التدريب' : 'training'}
            title={isRTL ? 'التدريب والتطوير' : 'Training & Development'}
            columns={[
              { header: isRTL ? 'البرنامج' : 'Program', key: r => isRTL ? r.title : r.title_en },
              { header: isRTL ? 'التصنيف' : 'Category', key: 'category' },
              { header: isRTL ? 'المدة (ساعات)' : 'Duration (hrs)', key: 'duration' },
              { header: isRTL ? 'المسجلين' : 'Enrolled', key: 'enrolled' },
              { header: isRTL ? 'المكتملين' : 'Completed', key: 'completed' },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
            ]}
          />
          <Button size="md"><Plus size={16}/>{lang==='ar'?'+ برنامج جديد':'+ New Program'}</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={BookOpen}     label={lang==='ar'?'إجمالي البرامج':'Total Programs'} value={filtered.length} color="#1B3347" />
        <KpiCard icon={Clock}        label={lang==='ar'?'نشطة':'Active'}            value={active}          color="#6B8DB5" />
        <KpiCard icon={Users}        label={lang==='ar'?'إجمالي المسجلين':'Enrolled'}         value={totalEnr}        color="#4A7AAB" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'أتموا التدريب':'Completed'}        value={totalComp}       color="#2B4C6F" />
      </div>

      <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />

      {/* Program Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-5 col-span-2">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={24} color='#4A7AAB' />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد برامج تدريبية':'No Training Programs'}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي برامج تدريبية بعد':'No training programs added yet'}</p>
          </div>
        ) : paged.map(prog => {
          const pct = prog.enrolled ? Math.round(prog.completed/prog.enrolled*100) : 0;
          return (
            <Card key={prog.id} hover className="p-5">
              <div className={`flex justify-between items-start mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={'text-start'}>
                  <p className="m-0 mb-1 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?prog.title:prog.title_en}</p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{prog.duration} {lang==='ar'?'ساعة':'hrs'} • {prog.start}</p>
                </div>
                <Badge className="shrink-0" style={{ background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35` }}>{statusLabel(prog.status,lang)}</Badge>
              </div>
              <div className={`flex justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'التقدم':'Progress'}: {pct}%</span>
                <span className="text-xs font-semibold text-brand-500">{prog.completed}/{prog.enrolled} {lang==='ar'?'موظف':'emp'}</span>
              </div>
              <div className="h-[5px] rounded-sm bg-slate-200 dark:bg-white/[0.08]">
                <div className="h-full rounded-sm transition-[width] duration-500" style={{ width:pct+'%', background:'linear-gradient(90deg,#1B3347,#4A7AAB)' }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Training Records Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'سجل التدريب':'Training Records'}</p>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'البرنامج':'Program', lang==='ar'?'المدة':'Duration', lang==='ar'?'مسجلون':'Enrolled', lang==='ar'?'أتموا':'Completed', lang==='ar'?'الحالة':'Status'].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(prog => (
              <Tr key={prog.id}>
                <Td>
                  <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background:'linear-gradient(135deg,#1B3347,#4A7AAB)' }}>
                      <BookOpen size={14} color="#fff" />
                    </div>
                    <span className="font-bold">{lang==='ar'?prog.title:prog.title_en}</span>
                  </div>
                </Td>
                <Td className="text-content-muted dark:text-content-muted-dark">{prog.duration}h</Td>
                <Td className="font-semibold text-brand-500">{prog.enrolled}</Td>
                <Td className="font-semibold">{prog.completed}</Td>
                <Td><Badge style={{ background:statusColor(prog.status)+'18', color:statusColor(prog.status), border:`1px solid ${statusColor(prog.status)}35` }}>{statusLabel(prog.status,lang)}</Badge></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
    </div>
  );
}
