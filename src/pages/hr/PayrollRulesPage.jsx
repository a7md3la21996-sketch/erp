import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPayrollRules, updateRule, clearRulesCache } from '../../services/payrollRulesService';
import { useToast } from '../../contexts/ToastContext';
import { Settings, Save } from 'lucide-react';
import { Button, Card, CardHeader, PageSkeleton } from '../../components/ui';

const CATEGORY_LABELS = {
  deduction: { ar: 'قواعد الخصم', en: 'Deduction Rules' },
  earning: { ar: 'المستحقات', en: 'Earnings' },
  limit: { ar: 'حدود', en: 'Limits' },
  attendance: { ar: 'الحضور', en: 'Attendance' },
  leave: { ar: 'الإجازات', en: 'Leave' },
};

const UNIT_LABELS = {
  per_minute: { ar: 'لكل دقيقة', en: 'per minute' },
  per_day: { ar: 'لكل يوم', en: 'per day' },
  percent: { ar: '%', en: '%' },
  multiplier: { ar: 'مضاعف', en: 'multiplier' },
  minutes: { ar: 'دقيقة', en: 'minutes' },
  days: { ar: 'يوم', en: 'days' },
};

export default function PayrollRulesPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPayrollRules().then(data => {
      setRules(data);
      const vals = {};
      data.forEach(r => { vals[r.id] = r.rule_value; });
      setEditValues(vals);
      setLoading(false);
    });
  }, []);

  const hasChanges = rules.some(r => Number(editValues[r.id]) !== Number(r.rule_value));

  const handleSaveAll = async () => {
    setSaving(true);
    let count = 0;
    for (const rule of rules) {
      const newVal = Number(editValues[rule.id]);
      if (newVal !== Number(rule.rule_value)) {
        await updateRule(rule.id, newVal);
        count++;
      }
    }
    clearRulesCache();
    const updated = await fetchPayrollRules();
    setRules(updated);
    setSaving(false);
    showToast(lang === 'ar' ? `تم حفظ ${count} تعديل` : `${count} rules updated`, 'success');
  };

  // Group by category
  const grouped = {};
  rules.forEach(r => {
    const cat = r.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis={false} tableRows={8} tableCols={4} /></div>;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Settings size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'قواعد المرتبات' : 'Payroll Rules'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إعدادات الخصومات والمستحقات' : 'Deduction & earning settings'}
            </p>
          </div>
        </div>
        {hasChanges && (
          <Button size="md" onClick={handleSaveAll} disabled={saving}>
            <Save size={14} />
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
          </Button>
        )}
      </div>

      {/* Info box */}
      <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-4 mb-5">
        <p className="m-0 text-sm text-content dark:text-content-dark">
          {lang === 'ar'
            ? 'القواعد دي بتتطبق على كل الموظفين بشكل افتراضي. ممكن تتغير لكل موظف من صفحة تعديل الموظف.'
            : 'These rules apply to all employees by default. They can be overridden per employee from the employee edit page.'}
        </p>
      </div>

      {/* Rules by category */}
      <div className="space-y-5">
        {Object.entries(grouped).map(([cat, catRules]) => {
          const catLabel = CATEGORY_LABELS[cat] || { ar: cat, en: cat };
          return (
            <Card key={cat} className="overflow-hidden">
              <CardHeader>
                <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
                  {lang === 'ar' ? catLabel.ar : catLabel.en}
                </p>
              </CardHeader>
              <div className="divide-y divide-edge dark:divide-edge-dark">
                {catRules.map(rule => {
                  const unitLabel = UNIT_LABELS[rule.unit] || { ar: rule.unit, en: rule.unit };
                  const changed = Number(editValues[rule.id]) !== Number(rule.rule_value);

                  return (
                    <div key={rule.id} className={`flex flex-wrap items-center gap-4 px-4 py-3.5 ${changed ? 'bg-brand-500/5' : ''}`}>
                      <div className="flex-1 min-w-[200px]">
                        <p className="m-0 text-sm font-medium text-content dark:text-content-dark">
                          {lang === 'ar' ? rule.name_ar : rule.name_en}
                        </p>
                        <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark mt-0.5">
                          {lang === 'ar' ? rule.description_ar : rule.description_en}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={rule.unit === 'percent' || rule.unit === 'multiplier' ? '0.1' : '1'}
                          value={editValues[rule.id] ?? rule.rule_value}
                          onChange={e => setEditValues(prev => ({ ...prev, [rule.id]: e.target.value }))}
                          className={`w-24 px-3 py-1.5 rounded-lg border text-sm text-center font-bold ${
                            changed
                              ? 'border-brand-500 bg-brand-500/10 text-brand-600'
                              : 'border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-content dark:text-content-dark'
                          }`}
                        />
                        <span className="text-xs text-content-muted dark:text-content-muted-dark min-w-[60px]">
                          {lang === 'ar' ? unitLabel.ar : unitLabel.en}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
