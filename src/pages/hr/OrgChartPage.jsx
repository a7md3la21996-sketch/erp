import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEmployees, fetchDepartments } from '../../services/employeesService';
import { Users, Building2 } from 'lucide-react';
import { Card, PageSkeleton } from '../../components/ui';

/* ─── Avatar initials ─── */
function Avatar({ name, size = 40 }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="rounded-full bg-brand-500/15 text-brand-500 font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

/* ─── Employee card ─── */
function EmployeeCard({ employee, lang, isRTL }) {
  const name = lang === 'ar' ? (employee.full_name_ar || employee.full_name_en) : (employee.full_name_en || employee.full_name_ar);
  const title = lang === 'ar' ? (employee.job_title_ar || employee.job_title_en || '') : (employee.job_title_en || employee.job_title_ar || '');
  return (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-3 flex items-center gap-2.5 min-w-0">
      <Avatar name={name} size={36} />
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold text-content dark:text-content-dark truncate">{name || '-'}</p>
        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark truncate">{title || '-'}</p>
      </div>
    </div>
  );
}

/* ─── Manager sub-tree ─── */
function ManagerSubTree({ manager, subordinates, lang, isRTL }) {
  const name = lang === 'ar' ? (manager.full_name_ar || manager.full_name_en) : (manager.full_name_en || manager.full_name_ar);
  const title = lang === 'ar' ? (manager.job_title_ar || manager.job_title_en || '') : (manager.job_title_en || manager.job_title_ar || '');

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Manager card */}
      <div className="bg-surface-card dark:bg-surface-card-dark border-2 border-brand-500/30 rounded-xl p-3 flex items-center gap-2.5 min-w-0">
        <Avatar name={name} size={36} />
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold text-content dark:text-content-dark truncate">{name || '-'}</p>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark truncate">{title || '-'}</p>
        </div>
      </div>
      {/* Connector line */}
      {subordinates.length > 0 && (
        <>
          <div className="w-px h-4 bg-edge dark:bg-edge-dark" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
            {subordinates.map(emp => (
              <EmployeeCard key={emp.id} employee={emp} lang={lang} isRTL={isRTL} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function OrgChartPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEmployees(), fetchDepartments()])
      .then(([emps, depts]) => {
        setEmployees(emps);
        setDepartments(depts);
      })
      .finally(() => setLoading(false));
  }, []);

  /* Group employees by department */
  const deptTree = useMemo(() => {
    const deptMap = {};
    departments.forEach(d => {
      deptMap[d.id] = {
        ...d,
        label: lang === 'ar' ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar),
        employees: [],
      };
    });
    const unassigned = [];
    employees.forEach(emp => {
      if (emp.department_id && deptMap[emp.department_id]) {
        deptMap[emp.department_id].employees.push(emp);
      } else {
        unassigned.push(emp);
      }
    });

    const result = Object.values(deptMap).filter(d => d.employees.length > 0);

    // Sort departments alphabetically
    result.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    if (unassigned.length > 0) {
      result.push({
        id: '__unassigned',
        label: lang === 'ar' ? 'بدون قسم' : 'Unassigned',
        employees: unassigned,
      });
    }
    return result;
  }, [employees, departments, lang]);

  /* For each department, split into managers + subordinates */
  const buildDeptLayout = (deptEmployees) => {
    const managerIds = new Set(deptEmployees.map(e => e.direct_manager_id).filter(Boolean));
    const managers = deptEmployees.filter(e => managerIds.has(e.id));
    const nonManagers = deptEmployees.filter(e => !managerIds.has(e.id));

    if (managers.length === 0) {
      // No reporting structure, show all as flat
      return { managers: [], flat: deptEmployees };
    }

    const subordinateMap = {};
    managers.forEach(m => { subordinateMap[m.id] = []; });
    const orphans = [];
    nonManagers.forEach(emp => {
      if (emp.direct_manager_id && subordinateMap[emp.direct_manager_id]) {
        subordinateMap[emp.direct_manager_id].push(emp);
      } else {
        orphans.push(emp);
      }
    });

    return { managers, subordinateMap, flat: orphans };
  };

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis={false} tableRows={6} tableCols={3} /></div>;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Users size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الهيكل التنظيمي' : 'Org Chart'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'عرض التسلسل الإداري للشركة' : 'Company organizational hierarchy'}
            </p>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="flex flex-col items-center gap-6">
        {/* Company root */}
        <Card className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <Building2 size={22} className="text-brand-500" />
            <span className="text-lg font-bold text-content dark:text-content-dark">Platform Real Estate</span>
          </div>
        </Card>

        {/* Connector */}
        {deptTree.length > 0 && <div className="w-px h-6 bg-edge dark:bg-edge-dark" />}

        {/* Departments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
          {deptTree.map(dept => {
            const layout = buildDeptLayout(dept.employees);
            return (
              <Card key={dept.id} className="p-4 flex flex-col gap-3">
                {/* Department header */}
                <div className={`flex items-center gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-brand-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold text-content dark:text-content-dark truncate">{dept.label}</p>
                    <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                      {dept.employees.length} {lang === 'ar' ? 'موظف' : 'employee(s)'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-edge dark:border-edge-dark" />

                {/* Manager sub-trees */}
                {layout.managers && layout.managers.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {layout.managers.map(mgr => (
                      <ManagerSubTree
                        key={mgr.id}
                        manager={mgr}
                        subordinates={layout.subordinateMap?.[mgr.id] || []}
                        lang={lang}
                        isRTL={isRTL}
                      />
                    ))}
                  </div>
                )}

                {/* Flat employees (no manager structure or orphans) */}
                {layout.flat.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {layout.flat.map(emp => (
                      <EmployeeCard key={emp.id} employee={emp} lang={lang} isRTL={isRTL} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {deptTree.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-brand-500" />
            </div>
            <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}
            </p>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'أضف موظفين وأقسام أولاً' : 'Add employees and departments first'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
