import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees } from '../../services/employeesService';
import { UserPlus, CheckCircle2, Clock, AlertCircle, ChevronRight, UserCheck } from 'lucide-react';
import { KpiCard } from '../../components/ui';

const ONBOARDING_STEPS = [
  { id:'docs', label_ar:'المستندات', label_en:'Documents', icon:'📄' },
  { id:'equipment', label_ar:'المعدات', label_en:'Equipment', icon:'💻' },
  { id:'training', label_ar:'التدريب', label_en:'Training', icon:'🏆' },
  { id:'system', label_ar:'الأنظمة', label_en:'System Access', icon:'🔐' },
  { id:'intro', label_ar:'التعريف', label_en:'Introduction', icon:'🤝' },
];

const MOCK_ONBOARDING = [
  { emp_id:'EMP-001', start:'2026-03-01', progress:{ docs:true, equipment:true, training:true, system:true, intro:false } },
  { emp_id:'EMP-002', start:'2026-03-08', progress:{ docs:true, equipment:false, training:false, system:false, intro:false } },
  { emp_id:'EMP-003', start:'2026-02-15', progress:{ docs:true, equipment:true, training:true, system:true, intro:true } },
];

export default function OnboardingPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [expanded, setExpanded] = useState(null);
  const [employees, setEmployees] = useState([]);

  useEffect(() => { fetchEmployees().then(data => setEmployees(data)); }, []);

  const completed = MOCK_ONBOARDING.filter(o=>Object.values(o.progress).every(Boolean)).length;
  const inProgress = MOCK_ONBOARDING.filter(o=>!Object.values(o.progress).every(Boolean)&&Object.values(o.progress).some(Boolean)).length;
  const notStarted = MOCK_ONBOARDING.filter(o=>Object.values(o.progress).every(v=>!v)).length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <UserPlus size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'استقبال الموظفين':'Employee Onboarding'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'تتبع مسار استقبال الموظفين الجدد':'Track new employee onboarding'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={UserPlus}     label={lang==='ar'?'إجمالي':'Total'}        value={MOCK_ONBOARDING.length} color="#1B3347" />
        <KpiCard icon={CheckCircle2} label={lang==='ar'?'مكتمل':'Completed'}    value={completed}             color="#4A7AAB" />
        <KpiCard icon={Clock}        label={lang==='ar'?'جاري':'In Progress'}   value={inProgress}            color="#6B8DB5" />
        <KpiCard icon={AlertCircle}  label={lang==='ar'?'لم يبدأ':'Not Started'}  value={notStarted}            color="#EF4444" />
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_ONBOARDING.length === 0 ? (
          <div className="text-center py-16 px-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={24} color='#4A7AAB' />
            </div>
            <p className="m-0 mb-1.5 text-[15px] font-bold text-content dark:text-content-dark">{lang==='ar'?'لا يوجد موظفون في التهيئة':'No Onboarding Employees'}</p>
            <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي موظفين في مرحلة التهيئة':'No employees in onboarding'}</p>
          </div>
        ) : MOCK_ONBOARDING.map(ob => {
          const emp = employees.find(e=>e.employee_id===ob.emp_id||e.id===ob.emp_id);
          const name = emp ? ((isRTL?emp.full_name_ar:emp.full_name_en)||emp.full_name_ar) : ob.emp_id;
          const initials = name?.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()||'??';
          const done = Object.values(ob.progress).filter(Boolean).length;
          const total = Object.values(ob.progress).length;
          const pct = Math.round(done/total*100);
          const isExpanded = expanded===ob.emp_id;
          return <OnboardingRow key={ob.emp_id} ob={ob} name={name} initials={initials} done={done} total={total} pct={pct} isExpanded={isExpanded} isRTL={isRTL} lang={lang} onToggle={()=>setExpanded(isExpanded?null:ob.emp_id)} />;
        })}
      </div>
    </div>
  );
}

function OnboardingRow({ ob, name, initials, done, total, pct, isExpanded, isRTL, lang, onToggle }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark overflow-hidden transition-all duration-200"
      style={{
        borderColor: hov || isExpanded ? 'rgba(74,122,171,0.25)' : undefined,
        boxShadow: isExpanded ? '0 4px 16px rgba(74,122,171,0.12)' : 'none',
      }}
    >
      <div
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onToggle}
        className={`px-5 py-4 cursor-pointer flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-brand-900 to-brand-500 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className={'text-start'}>
            <p className="m-0 text-sm font-bold text-content dark:text-content-dark">{name}</p>
            <p className="m-0 text-[11px] text-content-muted dark:text-content-muted-dark">{lang==='ar'?'بدأ:':' Started:'} {ob.start}</p>
          </div>
        </div>
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="text-center">
            <p className="m-0 text-xl font-extrabold text-brand-500">{pct}%</p>
            <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark">{done}/{total}</p>
          </div>
          <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.08]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct+'%', background: pct===100 ? '#4A7AAB' : '#6B8DB5' }} />
          </div>
          <div className={`text-content-muted dark:text-content-muted-dark transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isRTL && !isExpanded ? 'rotate-180' : ''}`}>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-5 pb-4 pt-3.5 border-t border-edge dark:border-edge-dark grid grid-cols-5 gap-2">
          {ONBOARDING_STEPS.map(step => {
            const stepDone = ob.progress[step.id];
            return (
              <div
                key={step.id}
                className={`px-3 py-2.5 rounded-[10px] border text-center ${stepDone ? 'border-brand-500/25 bg-brand-500/[0.08]' : 'border-edge dark:border-edge-dark bg-transparent'}`}
              >
                <div className="text-xl mb-1">{step.icon}</div>
                <p className="m-0 mb-1.5 text-[11px] font-semibold text-content dark:text-content-dark">{lang==='ar'?step.label_ar:step.label_en}</p>
                {stepDone ? <CheckCircle2 size={16} color="#4A7AAB" /> : <Clock size={16} className="text-content-muted dark:text-content-muted-dark" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
