import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../../lib/supabase';
import { Award, TrendingUp, Users, Star, ChevronDown } from 'lucide-react';
import { KpiCard, Badge, Button, Card, FilterPill, Table, Th, Td, Tr, Pagination, SmartFilter, applySmartFilters } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';

export default function CompetenciesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language==='ar'; const lang = i18n.language;
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [smartFilters, setSmartFilters] = useState([]);

  const { auditFields, applyAuditFilters } = useAuditFilter('competency');

  const DEFAULTS = [
    { key: 'communication', name_ar: 'التواصل', name_en: 'Communication', icon: 'MessageCircle', weight: 20, category: 'core', required_level: 3 },
    { key: 'teamwork', name_ar: 'العمل الجماعي', name_en: 'Teamwork', icon: 'Users', weight: 15, category: 'core', required_level: 3 },
    { key: 'initiative', name_ar: 'المبادرة', name_en: 'Initiative', icon: 'Zap', weight: 15, category: 'core', required_level: 3 },
    { key: 'problem_solving', name_ar: 'حل المشكلات', name_en: 'Problem Solving', icon: 'Lightbulb', weight: 20, category: 'technical', required_level: 4 },
    { key: 'attendance', name_ar: 'الالتزام والحضور', name_en: 'Commitment', icon: 'Clock', weight: 15, category: 'behavioral', required_level: 3 },
    { key: 'quality', name_ar: 'جودة العمل', name_en: 'Work Quality', icon: 'CheckCircle2', weight: 15, category: 'technical', required_level: 4 },
  ];

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('competencies').select('*').order('created_at');
        if (error) throw error;
        if (data?.length) { setCompetencies(data); }
        else {
          // Seed defaults
          const { data: seeded } = await supabase.from('competencies').upsert(DEFAULTS, { onConflict: 'key' }).select('*');
          setCompetencies(seeded || DEFAULTS);
        }
      } catch { setCompetencies(DEFAULTS); }
      setLoading(false);
    })();
  }, []);

  const categories = [...new Set(competencies.map(c=>c.category).filter(Boolean))];

  const SMART_FIELDS = useMemo(() => [
    {
      id: 'category', label: 'الفئة', labelEn: 'Category', type: 'select',
      options: categories.map(c => ({ value: c, label: c, labelEn: c })),
    },
    {
      id: 'required_level', label: 'المستوى المطلوب', labelEn: 'Required Level', type: 'select',
      options: [1,2,3,4,5].map(n => ({ value: n, label: String(n), labelEn: String(n) })),
    },
    ...auditFields,
  ], [auditFields, categories.length]);

  const filtered = useMemo(() => {
    let result = filter==='all' ? competencies : competencies.filter(c=>c.category===filter);
    result = applySmartFilters(result, smartFilters, SMART_FIELDS);
    result = applyAuditFilters(result, smartFilters);
    return result;
  }, [filter, smartFilters, SMART_FIELDS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [filter, smartFilters]);

  const avgLevel = Math.round(competencies.reduce((s,c)=>s+(c.required_level||3),0)/competencies.length);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Award size={22} className="text-brand-500" />
          </div>
          <div className={'text-start'}>
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang==='ar'?'الكفاءات':'Competencies'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'إدارة كفاءات الموظفين':'Manage employee competencies'}</p>
          </div>
        </div>
        <Button size="md">{lang==='ar'?'+ كفاءة جديدة':'+ Add Competency'}</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        <KpiCard icon={Award} label={lang==='ar'?'إجمالي الكفاءات':'Total Competencies'} value={competencies.length} color="#1B3347" />
        <KpiCard icon={Users} label={lang==='ar'?'عدد الفئات':'Categories'} value={categories.length} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang==='ar'?'متوسط المستوى':'Avg Level'} value={avgLevel+'/5'} color="#6B8DB5" />
        <KpiCard icon={Star} label={lang==='ar'?'كفاءات متقدمة':'Advanced'} value={competencies.filter(c=>c.required_level>=4).length} color="#2B4C6F" />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', ...categories].map(cat => (
          <FilterPill
            key={cat}
            label={cat==='all'?(lang==='ar'?'الكل':'All'):cat}
            active={filter===cat}
            onClick={()=>setFilter(cat)}
          />
        ))}
      </div>

      <SmartFilter
        fields={SMART_FIELDS}
        filters={smartFilters}
        onFiltersChange={setSmartFilters}
      />

      {/* Competencies Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              {[lang==='ar'?'الكفاءة':'Competency', lang==='ar'?'الفئة':'Category', lang==='ar'?'المستوى المطلوب':'Required Level', lang==='ar'?'التقييم':'Rating', ''].map((h,i)=>(
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-16 px-5">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <Star size={24} color='#4A7AAB' />
                </div>
                <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang==='ar'?'لا توجد كفاءات مسجلة':'No Competencies Found'}</p>
                <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?'لم يتم إضافة أي كفاءات بعد':'No competencies added yet'}</p>
              </td></tr>
            ) : paged.map((comp, idx) => {
              const isExp = expanded===idx;
              return (
                <tbody key={idx}>
                  <Tr className="cursor-pointer" onClick={()=>setExpanded(isExp?null:idx)}>
                    <Td className="font-bold">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        {lang==='ar'?comp.name_ar:comp.name_en}
                      </div>
                    </Td>
                    <Td>
                      <Badge className="bg-brand-500/[0.12] text-brand-500 border border-brand-500/25">{comp.category}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-[3px]">
                        {[1,2,3,4,5].map(i=>(
                          <div key={i} className={`w-4 h-4 rounded transition-colors duration-200 ${i<=(comp.required_level||3)?'bg-brand-500':'bg-brand-500/15'}`} />
                        ))}
                      </div>
                    </Td>
                    <Td className="text-content-muted dark:text-content-muted-dark text-xs">{comp.description_ar||comp.description_en||'-'}</Td>
                    <Td>
                      <ChevronDown size={14} className={`text-content-muted dark:text-content-muted-dark transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                    </Td>
                  </Tr>
                  {isExp && (
                    <tr className="bg-[#F8FAFC] dark:bg-brand-500/[0.04] border-b border-edge dark:border-edge-dark">
                      <td colSpan={5} className="px-5 py-3.5">
                        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang==='ar'?comp.description_ar:comp.description_en}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} totalItems={filtered.length} />
    </div>
  );
}
