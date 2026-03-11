import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, BookOpen, Shield, Clock, Plus, Eye, Download } from 'lucide-react';
import { Button, Card, KpiCard, Tr, Td } from '../../components/ui';


const MOCK_POLICIES = [
  { id:1, title_ar:'سياسة الحضور', title_en:'Attendance Policy', category:'attendance', status:'active', version:'2.1', updated:'2026-01-15', views:124 },
  { id:2, title_ar:'سياسة الإجازات', title_en:'Leave Policy', category:'leave', status:'active', version:'1.3', updated:'2025-11-20', views:98 },
  { id:3, title_ar:'سياسة السلوك المهني', title_en:'Code of Conduct', category:'conduct', status:'active', version:'3.0', updated:'2025-09-10', views:210 },
  { id:4, title_ar:'سياسة التطوير الوظيفي', title_en:'Career Development', category:'training', status:'draft', version:'1.0', updated:'2026-02-28', views:45 },
  { id:5, title_ar:'سياسة الرواتب والمكافآت', title_en:'Compensation Policy', category:'payroll', status:'active', version:'2.0', updated:'2026-01-01', views:167 },
  { id:6, title_ar:'سياسة الخصوصية', title_en:'Privacy Policy', category:'compliance', status:'active', version:'1.5', updated:'2025-12-15', views:77 },
];

const CATEGORIES = [
  { key:'all', label_ar:'الكل', label_en:'All', icon: FileText },
  { key:'attendance', label_ar:'حضور', label_en:'Attendance', icon: Clock },
  { key:'leave', label_ar:'إجازات', label_en:'Leave', icon: BookOpen },
  { key:'conduct', label_ar:'سلوك', label_en:'Conduct', icon: Shield },
];

export default function HRPoliciesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [cat, setCat] = useState('all');

  const filtered = cat==='all' ? MOCK_POLICIES : MOCK_POLICIES.filter(p=>p.category===cat);
  const active = MOCK_POLICIES.filter(p=>p.status==='active').length;
  const draft = MOCK_POLICIES.filter(p=>p.status==='draft').length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-7 py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shadow-md">
            <FileText size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{lang==='ar'?'سياسات الموارد البشرية':'HR Policies'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة سياسات وأنظمة الشركة':'Manage company policies & guidelines'}</p>
          </div>
        </div>
        <Button size="md">
          <Plus size={16} />{lang==='ar'?'+ سياسة جديدة':'+ New Policy'}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={FileText}  label={lang==='ar'?'إجمالي السياسات':'Total Policies'} value={MOCK_POLICIES.length} color="#1B3347" />
        <KpiCard icon={Shield}    label={lang==='ar'?'نشطة':'Active'}               value={active}                color="#4A7AAB" />
        <KpiCard icon={Clock}     label={lang==='ar'?'مسودة':'Draft'}                value={draft}                 color="#6B8DB5" />
        <KpiCard icon={BookOpen}  label={lang==='ar'?'إجمالي المشاهدات':'Total Views'}     value={MOCK_POLICIES.reduce((s,p)=>s+p.views,0)} color="#2B4C6F" />
      </div>

      <Card className="!rounded-xl overflow-hidden">
        <div className={`px-4 py-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'قائمة السياسات':'Policies List'}</p>
          <div className="flex gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={()=>setCat(c.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border
                  ${cat===c.key
                    ? 'border-brand-500/60 bg-brand-500/15 text-brand-500'
                    : 'border-edge dark:border-edge-dark bg-transparent text-content-muted dark:text-content-muted-dark hover:border-brand-500/40'
                  }`}
              >
                {lang==='ar'?c.label_ar:c.label_en}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
              {[lang==='ar'?'السياسة':'Policy', lang==='ar'?'التصنيف':'Category', lang==='ar'?'الإصدار':'Version', lang==='ar'?'آخر تحديث':'Updated', lang==='ar'?'الحالة':'Status', lang==='ar'?'المشاهدات':'Views', ''].map((h,i)=>(
                <th key={i} className={`text-[11px] font-bold text-content-muted dark:text-content-muted-dark px-3.5 py-2.5 uppercase tracking-wider ${isRTL?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(policy => (
              <PolicyRow key={policy.id} policy={policy} isRTL={isRTL} lang={lang} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PolicyRow({ policy, isRTL, lang }) {
  return (
    <Tr>
      <Td>
        <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[34px] h-[34px] rounded-lg bg-brand-500/[0.12] flex items-center justify-center shrink-0">
            <FileText size={15} color="#4A7AAB" />
          </div>
          <p className="m-0 text-[13px] font-bold text-content dark:text-content-dark">{lang==='ar'?policy.title_ar:policy.title_en}</p>
        </div>
      </Td>
      <Td>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/[0.12] text-brand-500 border border-brand-500/25">
          {policy.category}
        </span>
      </Td>
      <Td className="text-content-muted dark:text-content-muted-dark">v{policy.version}</Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{policy.updated}</Td>
      <Td>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
          policy.status==='active'
            ? 'bg-brand-500/15 text-brand-500 border-brand-500/30'
            : 'bg-brand-300/15 text-brand-300 border-brand-300/30'
        }`}>
          {policy.status==='active'?(lang==='ar'?'نشط':'Active'):(lang==='ar'?'مسودة':'Draft')}
        </span>
      </Td>
      <Td className="text-content-muted dark:text-content-muted-dark">{policy.views}</Td>
      <Td>
        <div className="flex gap-1.5">
          <button className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-500/15 hover:border-brand-500/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-brand-500">
            <Eye size={13} />
          </button>
          <button className="w-[30px] h-[30px] rounded-lg border border-edge dark:border-edge-dark bg-transparent hover:bg-brand-300/15 hover:border-brand-300/60 cursor-pointer flex items-center justify-center transition-all duration-150 text-content-muted dark:text-content-muted-dark hover:text-brand-300">
            <Download size={13} />
          </button>
        </div>
      </Td>
    </Tr>
  );
}
