import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { Package, CheckCircle2, AlertCircle, Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button, Card, KpiCard, Th, Tr, Td, FilterPill, ExportButton, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';


const MOCK_ASSETS = [
  { id:1, name:'MacBook Pro 14"', type:'laptop', serial:'MBP-2024-001', assigned_to:'EMP-001', status:'active', condition:'good', value:45000, acquired:'2024-01-15' },
  { id:2, name:'iPhone 15 Pro', type:'phone', serial:'IPH-2024-002', assigned_to:'EMP-002', status:'active', condition:'excellent', value:18000, acquired:'2024-02-10' },
  { id:3, name:'Dell Monitor 27"', type:'monitor', serial:'DLL-2023-003', assigned_to:'EMP-003', status:'active', condition:'good', value:8000, acquired:'2023-11-05' },
  { id:4, name:'Toyota Corolla 2023', type:'vehicle', serial:'VEH-2023-001', assigned_to:'EMP-001', status:'maintenance', condition:'fair', value:280000, acquired:'2023-06-20' },
  { id:5, name:'HP LaserJet Pro', type:'printer', serial:'HPL-2023-004', assigned_to:null, status:'available', condition:'good', value:12000, acquired:'2023-08-14' },
  { id:6, name:'iPad Pro 12.9"', type:'tablet', serial:'IPD-2024-005', assigned_to:'EMP-004', status:'active', condition:'excellent', value:22000, acquired:'2024-03-01' },
];

export default function AssetsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [assets] = useState(MOCK_ASSETS);
  const [filter, setFilter] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  const { auditFields, applyAuditFilters } = useAuditFilter('asset');

  useEffect(() => { fetchEmployees().then(data => setEmployees(data)); }, []);

  const SMART_FIELDS = useMemo(() => [
    ...auditFields,
  ], [auditFields]);

  const filtered = useMemo(() => {
    let result = filter==='all' ? assets : assets.filter(a=>a.status===filter);
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [assets, filter, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [filter]);

  const active = assets.filter(a=>a.status==='active').length;
  const available = assets.filter(a=>a.status==='available').length;
  const maintenance = assets.filter(a=>a.status==='maintenance').length;
  const totalValue = assets.reduce((s,a)=>s+a.value,0);

  const statusColor = s => s==='active'?'#4A7AAB':s==='available'?'#6B8DB5':s==='maintenance'?'#EF4444':'#8BA8C8';
  const statusLabel = (s,lang) => ({active:lang==='ar'?'مستخدم':'Active',available:lang==='ar'?'متاح':'Available',maintenance:lang==='ar'?'صيانة':'Maintenance'}[s]||s);

  const filters = [
    {key:'all',label:lang==='ar'?'الكل':'All'},
    {key:'active',label:lang==='ar'?'مستخدم':'Active'},
    {key:'available',label:lang==='ar'?'متاح':'Available'},
    {key:'maintenance',label:lang==='ar'?'صيانة':'Maintenance'},
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex flex-wrap justify-between items-center gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Package size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'إدارة الأصول':'Asset Management'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'تتبع أصول الشركة':'Track company assets'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <ExportButton
            data={filtered}
            filename={isRTL ? 'الأصول' : 'assets'}
            title={isRTL ? 'إدارة الأصول' : 'Asset Management'}
            columns={[
              { header: isRTL ? 'الاسم' : 'Name', key: 'name' },
              { header: isRTL ? 'النوع' : 'Type', key: 'type' },
              { header: isRTL ? 'الرقم التسلسلي' : 'Serial', key: 'serial' },
              { header: isRTL ? 'مخصص لـ' : 'Assigned To', key: 'assigned_to' },
              { header: isRTL ? 'الحالة' : 'Status', key: r => statusLabel(r.status, lang) },
              { header: isRTL ? 'القيمة' : 'Value', key: 'value' },
            ]}
          />
          <Button size="md">
            <Plus size={16} />{lang==='ar'?'+ أضف أصل':'+ Add Asset'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Package}      label={lang==='ar'?'إجمالي الأصول':'Total Assets'}   value={assets.length}  color="#1B3347" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مستخدمة':'Active'}            value={active}         color="#4A7AAB" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'متاحة':'Available'}          value={available}      color="#6B8DB5" />
        <KpiCard icon={Clock}        label={lang==='ar'?'صيانة':'Maintenance'}        value={maintenance}    color="#EF4444" />
      </div>

      <Card className="!rounded-xl overflow-hidden">
        <div className={`px-4 py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'قائمة الأصول':'Asset List'}</p>
          <div className="flex gap-1.5 items-center">
            {filters.map(f => (
              <FilterPill key={f.key} label={f.label} active={filter===f.key} onClick={()=>setFilter(f.key)} />
            ))}
            <SmartFilter fields={SMART_FIELDS} filters={smartFilters} onChange={setSmartFilters} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <Package size={24} color="#4A7AAB" />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد أصول مسجلة':'No Assets Found'}</p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم تسجيل أي أصول بعد':'No assets registered yet'}</p>
          </div>
        ) : (<>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[lang==='ar'?'الأصل':'Asset', lang==='ar'?'النوع':'Type', lang==='ar'?'مخصص ل':'Assigned To', lang==='ar'?'الحالة':'Status', lang==='ar'?'القيمة':'Value', ''].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(asset => (
              <AssetRow key={asset.id} asset={asset} isRTL={isRTL} lang={lang} statusColor={statusColor} statusLabel={statusLabel} employees={employees} />
            ))}
          </tbody>
        </table>
        <div className={`px-4 py-3 border-t border-edge dark:border-edge-dark flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">{filtered.length} {lang==='ar'?'أصل':' assets'}</span>
          <span className="text-xs font-bold text-brand-500">{lang==='ar'?'إجمالي القيمة:':'Total Value:'} {totalValue.toLocaleString()} ج.م</span>
        </div>
        </>)}
      </Card>
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
    </div>
  );
}

function AssetRow({ asset, isRTL, lang, statusColor, statusLabel, employees }) {
  const emp = employees.find(e=>e.employee_id===asset.assigned_to||e.id===asset.assigned_to);
  const empName = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : (lang==='ar'?'غير مخصص':'Unassigned');
  return (
    <Tr>
      <Td>
        <p className="m-0 text-xs font-bold text-content dark:text-content-dark">{asset.name}</p>
        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{asset.serial}</p>
      </Td>
      <Td>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/[0.12] text-brand-500 border border-brand-500/25">
          {asset.type}
        </span>
      </Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{empName}</Td>
      <Td>
        <span
          className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: statusColor(asset.status)+'18', color: statusColor(asset.status), border: `1px solid ${statusColor(asset.status)}35` }}
        >
          {statusLabel(asset.status,lang)}
        </span>
      </Td>
      <Td className="font-bold text-brand-500">{asset.value.toLocaleString()} ج.م</Td>
      <Td>
        <div className="flex gap-1.5">
          <button className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/15 hover:border-brand-500/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-brand-500">
            <Edit2 size={13} />
          </button>
          <button className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-red-500/15 hover:border-red-500/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </Td>
    </Tr>
  );
}
