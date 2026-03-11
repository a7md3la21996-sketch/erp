import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Users, Clock, CheckCircle2, Plus, Eye } from 'lucide-react';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import { Table, Th, Td, Tr } from '../../components/ui/Table';

const MOCK_JOBS = [
  { id:1, title_ar:'مدير مبيعات', title_en:'Sales Manager', dept:'المبيعات', type:'full-time', status:'open', applicants:12, posted:'2026-02-15' },
  { id:2, title_ar:'محاسب', title_en:'Accountant', dept:'المالية', type:'full-time', status:'open', applicants:8, posted:'2026-02-20' },
  { id:3, title_ar:'مستشار عقاري', title_en:'Real Estate Consultant', dept:'العقارات', type:'full-time', status:'interviewing', applicants:5, posted:'2026-03-01' },
  { id:4, title_ar:'مدير تسويق', title_en:'Marketing Manager', dept:'التسويق', type:'full-time', status:'closed', applicants:20, posted:'2026-01-10' },
];

const statusColor = s => s==='open'?'#4A7AAB':s==='interviewing'?'#6B8DB5':'#8BA8C8';
const statusLabel = (s,lang) => ({ open:lang==='ar'?'مفتوح':'Open', interviewing:lang==='ar'?'مقابلات':'Interviewing', closed:lang==='ar'?'مغلق':'Closed' }[s]||s);

function ViewBtn() {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      className={`w-[30px] h-[30px] rounded-lg border cursor-pointer flex items-center justify-center transition-all duration-150 ${hov ? 'border-brand-500/40 bg-brand-500/[0.12] scale-[1.08]' : 'border-edge dark:border-edge-dark bg-transparent scale-100'}`}
    >
      <Eye size={13} className={hov ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'} />
    </button>
  );
}

export default function RecruitmentPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [jobs] = useState(MOCK_JOBS);

  const open = jobs.filter(j=>j.status==='open').length;
  const interviewing = jobs.filter(j=>j.status==='interviewing').length;
  const totalApplicants = jobs.reduce((s,j)=>s+j.applicants,0);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 px-7 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[46px] h-[46px] rounded-xl bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shadow-md">
            <Briefcase size={22} color="#fff" />
          </div>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{lang==='ar'?'التوظيف':'Recruitment'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة طلبات التوظيف':'Manage job openings & applicants'}</p>
          </div>
        </div>
        <Button size="md">
          <Plus size={16} />{lang==='ar'?'+ وظيفة جديدة':'+ New Job'}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Briefcase} label={lang==='ar'?'إجمالي الوظائف':'Total Jobs'} value={jobs.length} color="#1B3347" />
        <KpiCard icon={Clock} label={lang==='ar'?'مفتوحة':'Open'} value={open} color="#4A7AAB" />
        <KpiCard icon={Users} label={lang==='ar'?'المتقدمون':'Applicants'} value={totalApplicants} color="#6B8DB5" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'ماتمت المقابلة':'Interviewing'} value={interviewing} color="#2B4C6F" />
      </div>

      <div className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-edge dark:border-edge-dark">
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'الوظائف المتاحة':'Job Openings'}</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-bg dark:bg-brand-500/[0.08] border-b-2 border-edge dark:border-edge-dark">
              {[lang==='ar'?'الوظيفة':'Position', lang==='ar'?'القسم':'Dept', lang==='ar'?'المتقدمون':'Applicants', lang==='ar'?'تاريخ النشر':'Posted', lang==='ar'?'الحالة':'Status', ''].map((h,i)=>(
                <th key={i} className={`text-[11px] font-bold text-content-muted dark:text-content-muted-dark px-3.5 py-2.5 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="text-center py-16 px-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                      <Briefcase size={24} color='#4A7AAB' />
                    </div>
                    <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد طلبات توظيف':'No Recruitment Requests'}</p>
                    <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي طلبات توظيف بعد':'No recruitment requests added yet'}</p>
                  </div>
                </td>
              </tr>
            ) : jobs.map(job => (
              <JobRow key={job.id} job={job} lang={lang} isRTL={isRTL} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job, lang, isRTL }) {
  const [hov, setHov] = useState(false);
  const sc = statusColor(job.status);
  return (
    <tr
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      className={`border-b border-edge dark:border-edge-dark transition-colors duration-150 ${hov ? 'bg-[#F8FAFC] dark:bg-brand-500/[0.07]' : 'bg-transparent'}`}
    >
      <td className="text-[13px] text-content dark:text-content-dark px-3.5 py-3 font-bold">{lang==='ar'?job.title_ar:job.title_en}</td>
      <td className="text-[13px] text-content-muted dark:text-content-muted-dark px-3.5 py-3">{job.dept}</td>
      <td className="text-[13px] px-3.5 py-3"><span className="font-bold text-brand-500">{job.applicants}</span></td>
      <td className="text-[13px] text-content-muted dark:text-content-muted-dark px-3.5 py-3">{job.posted}</td>
      <td className="text-[13px] px-3.5 py-3">
        <span
          className="px-2.5 py-[3px] rounded-full text-[11px] font-semibold"
          style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}35` }}
        >
          {statusLabel(job.status, lang)}
        </span>
      </td>
      <td className="text-[13px] px-3.5 py-3"><ViewBtn /></td>
    </tr>
  );
}
