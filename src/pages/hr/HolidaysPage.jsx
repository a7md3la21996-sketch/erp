import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchHolidays, createHoliday, createHolidaysBulk, deleteHoliday } from '../../services/holidaysService';
import { useToast } from '../../contexts/ToastContext';
import { Calendar, Plus, Trash2, Copy } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const DAY_NAMES_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DAY_NAMES_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const TYPES = [
  { value: 'holiday', ar: 'إجازة رسمية', en: 'Official Holiday' },
  { value: 'weekend_off', ar: 'إجازة سبت', en: 'Saturday Off' },
  { value: 'custom', ar: 'إجازة استثنائية', en: 'Custom Day Off' },
];

export default function HolidaysPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', name_ar: '', type: 'holiday' });
  const [showSaturdayHelper, setShowSaturdayHelper] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchHolidays(year, month);
      setHolidays(data);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [year, month]);

  // Get all Saturdays in the selected month
  const saturdays = useMemo(() => {
    const result = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() === 6) {
        result.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }
    return result;
  }, [year, month]);

  const holidayDates = new Set(holidays.map(h => h.date));

  const handleAdd = async () => {
    if (!form.date) return;
    try {
      const result = await createHoliday(form);
      setHolidays(prev => [...prev, result].sort((a, b) => a.date.localeCompare(b.date)));
      setModalOpen(false);
      showToast(lang === 'ar' ? 'تم الإضافة' : 'Added', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الإضافة' : 'Failed to add', 'error');
    }
  };

  const handleDelete = async (id) => {
    const msg = lang === 'ar' ? 'حذف هذه الإجازة؟' : 'Delete this holiday?';
    if (!window.confirm(msg)) return;
    try {
      await deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      showToast(lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الحذف' : 'Delete failed', 'error');
    }
  };

  const handleAddSaturdays = async (selectedDates) => {
    try {
      const newHolidays = selectedDates.map(date => ({
        date,
        name: 'Saturday Off',
        name_ar: 'إجازة سبت',
        type: 'weekend_off',
      }));
      const result = await createHolidaysBulk(newHolidays);
      setHolidays(prev => [...prev, ...result].sort((a, b) => a.date.localeCompare(b.date)));
      setShowSaturdayHelper(false);
      showToast(lang === 'ar' ? `تم إضافة ${result.length} إجازة سبت` : `${result.length} Saturdays added`, 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الإضافة' : 'Failed', 'error');
    }
  };

  if (loading) return (
    <div className="px-4 py-4 md:px-7 md:py-6">
      <PageSkeleton hasKpis={false} tableRows={5} tableCols={5} />
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-wrap justify-between items-center mb-5 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Calendar size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'الإجازات الرسمية' : 'Official Holidays'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {MONTHS_AR[month - 1]} {year}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_AR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </Select>
          <input
            type="number"
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="w-20 px-3 py-1.5 rounded-lg border border-edge dark:border-edge-dark bg-surface dark:bg-surface-dark text-sm text-content dark:text-content-dark"
          />
          <Button variant="secondary" size="md" onClick={() => setShowSaturdayHelper(true)}>
            <Copy size={14} />{lang === 'ar' ? 'إجازات السبت' : 'Saturdays'}
          </Button>
          <Button size="md" onClick={() => { setForm({ date: '', name: '', name_ar: '', type: 'holiday' }); setModalOpen(true); }}>
            <Plus size={14} />{lang === 'ar' ? 'إضافة إجازة' : 'Add Holiday'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'التاريخ' : 'Date'}</Th>
              <Th>{lang === 'ar' ? 'اليوم' : 'Day'}</Th>
              <Th>{lang === 'ar' ? 'الاسم' : 'Name'}</Th>
              <Th>{lang === 'ar' ? 'النوع' : 'Type'}</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا توجد إجازات مسجلة لهذا الشهر' : 'No holidays this month'}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                    {lang === 'ar' ? 'أضف إجازات السبت أو الإجازات الرسمية' : 'Add Saturday offs or official holidays'}
                  </p>
                </td>
              </tr>
            ) : holidays.map(h => {
              const d = new Date(h.date + 'T00:00:00');
              const dayName = lang === 'ar' ? DAY_NAMES_AR[d.getDay()] : DAY_NAMES_EN[d.getDay()];
              const typeLabel = TYPES.find(t => t.value === h.type);

              return (
                <Tr key={h.id}>
                  <Td className="font-mono font-bold">{h.date}</Td>
                  <Td>{dayName}</Td>
                  <Td>{(lang === 'ar' ? h.name_ar : h.name) || h.name || h.name_ar}</Td>
                  <Td>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      h.type === 'holiday' ? 'bg-red-500/15 text-red-500' :
                      h.type === 'weekend_off' ? 'bg-blue-500/15 text-blue-500' :
                      'bg-yellow-500/15 text-yellow-600'
                    }`}>
                      {lang === 'ar' ? typeLabel?.ar : typeLabel?.en}
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* Add Holiday Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={lang === 'ar' ? 'إضافة إجازة' : 'Add Holiday'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder="e.g. Eid Al-Fitr" />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</label>
            <input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} dir="rtl"
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder="مثال: عيد الفطر" />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'النوع' : 'Type'}</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm">
              {TYPES.map(t => <option key={t.value} value={t.value}>{lang === 'ar' ? t.ar : t.en}</option>)}
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleAdd} disabled={!form.date}>{lang === 'ar' ? 'إضافة' : 'Add'}</Button>
        </ModalFooter>
      </Modal>

      {/* Saturday Helper Modal */}
      <SaturdayHelperModal
        open={showSaturdayHelper}
        onClose={() => setShowSaturdayHelper(false)}
        saturdays={saturdays}
        alreadyAdded={holidayDates}
        onAdd={handleAddSaturdays}
        lang={lang}
        isRTL={isRTL}
        month={month}
        year={year}
      />
    </div>
  );
}

// ── Saturday Helper ──────────────────────────────────────────

function SaturdayHelperModal({ open, onClose, saturdays, alreadyAdded, onAdd, lang, isRTL, month, year }) {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    // Pre-select Saturdays not already added
    setSelected(saturdays.filter(d => !alreadyAdded.has(d)));
  }, [saturdays, alreadyAdded]);

  if (!open) return null;

  const toggle = (date) => {
    setSelected(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const available = saturdays.filter(d => !alreadyAdded.has(d));

  return (
    <Modal open={open} onClose={onClose} title={lang === 'ar' ? `سبتات ${MONTHS_AR[month - 1]} ${year}` : `Saturdays in ${MONTHS_AR[month - 1]} ${year}`}>
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        {available.length === 0 ? (
          <p className="text-center text-sm text-content-muted dark:text-content-muted-dark py-6">
            {lang === 'ar' ? 'كل السبتات مضافة بالفعل' : 'All Saturdays already added'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-content-muted dark:text-content-muted-dark mb-3">
              {lang === 'ar' ? 'اختار السبتات اللي عايزها إجازة:' : 'Select Saturdays to mark as off:'}
            </p>
            {saturdays.map(date => {
              const already = alreadyAdded.has(date);
              const isSelected = selected.includes(date);
              const day = parseInt(date.split('-')[2]);

              return (
                <label key={date} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  already ? 'border-green-500/30 bg-green-500/5 opacity-60' :
                  isSelected ? 'border-brand-500/30 bg-brand-500/5' :
                  'border-edge dark:border-edge-dark hover:bg-brand-500/5'
                }`}>
                  <input
                    type="checkbox"
                    checked={already || isSelected}
                    disabled={already}
                    onChange={() => !already && toggle(date)}
                    className="rounded"
                  />
                  <span className="text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? `السبت ${day} ${MONTHS_AR[month - 1]}` : `Saturday ${day} ${MONTHS_AR[month - 1]}`}
                  </span>
                  <span className="text-xs text-content-muted dark:text-content-muted-dark font-mono ms-auto">{date}</span>
                  {already && (
                    <span className="text-xs text-green-500 font-semibold">{lang === 'ar' ? 'مضاف' : 'Added'}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
        {available.length > 0 && (
          <Button onClick={() => onAdd(selected)} disabled={selected.length === 0}>
            {lang === 'ar' ? `إضافة ${selected.length} سبت كإجازة` : `Add ${selected.length} Saturdays`}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
