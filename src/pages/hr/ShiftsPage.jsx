import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchShifts, createShift, updateShift, deleteShift, setDefaultShift } from '../../services/shiftsService';
import { useToast } from '../../contexts/ToastContext';
import { Clock, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton } from '../../components/ui';

const EMPTY_FORM = { name: '', name_ar: '', official_start: '', official_end: '', late_threshold: '' };

export default function ShiftsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Load shifts ──────────────────────────────────────────────
  const loadShifts = async () => {
    try {
      setLoading(true);
      const data = await fetchShifts();
      setShifts(data);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل الفترات' : 'Failed to load shifts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShifts(); }, []);

  // ── Open modal ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (shift) => {
    setEditingId(shift.id);
    setForm({
      name: shift.name || '',
      name_ar: shift.name_ar || '',
      official_start: shift.official_start || '',
      official_end: shift.official_end || '',
      late_threshold: shift.late_threshold || '',
    });
    setModalOpen(true);
  };

  // ── Save (create / update) ──────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateShift(editingId, form);
        setShifts(prev => prev.map(s => s.id === editingId ? updated : s));
        showToast(lang === 'ar' ? 'تم التحديث بنجاح' : 'Shift updated', 'success');
      } else {
        const created = await createShift(form);
        setShifts(prev => [...prev, created]);
        showToast(lang === 'ar' ? 'تم الإضافة بنجاح' : 'Shift created', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast(lang === 'ar' ? 'فشل في الحفظ' : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const msg = lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete this shift?';
    if (!window.confirm(msg)) return;
    try {
      await deleteShift(id);
      setShifts(prev => prev.filter(s => s.id !== id));
      showToast(lang === 'ar' ? 'تم الحذف بنجاح' : 'Shift deleted', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل في الحذف' : 'Delete failed', 'error');
    }
  };

  // ── Set default ─────────────────────────────────────────────
  const handleSetDefault = async (id) => {
    try {
      await setDefaultShift(id);
      setShifts(prev => prev.map(s => ({ ...s, is_default: s.id === id })));
      showToast(lang === 'ar' ? 'تم تعيين الفترة الافتراضية' : 'Default shift updated', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل في التعيين' : 'Failed to set default', 'error');
    }
  };

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return <PageSkeleton hasKpis={false} tableRows={5} tableCols={7} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Clock size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
              {lang === 'ar' ? 'فترات الدوام' : 'Work Shifts'}
            </h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة فترات الدوام الرسمية' : 'Manage official work shifts'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={openAdd}>
          <Plus size={16} />
          {lang === 'ar' ? 'إضافة فترة' : 'Add Shift'}
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الاسم' : 'Name'}</Th>
              <Th>{lang === 'ar' ? 'الاسم بالعربي' : 'Name (AR)'}</Th>
              <Th>{lang === 'ar' ? 'بداية' : 'Start'}</Th>
              <Th>{lang === 'ar' ? 'نهاية' : 'End'}</Th>
              <Th>{lang === 'ar' ? 'حد التأخير' : 'Late Threshold'}</Th>
              <Th>{lang === 'ar' ? 'افتراضي' : 'Default'}</Th>
              <Th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</Th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا توجد فترات مسجلة' : 'No Shifts Found'}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                    {lang === 'ar' ? 'لم يتم إضافة أي فترات بعد' : 'No shifts added yet'}
                  </p>
                </td>
              </tr>
            ) : shifts.map(shift => (
              <Tr key={shift.id}>
                <Td className="font-bold">{shift.name}</Td>
                <Td>{shift.name_ar || '-'}</Td>
                <Td>{shift.official_start || '-'}</Td>
                <Td>{shift.official_end || '-'}</Td>
                <Td>{shift.late_threshold || '-'}</Td>
                <Td>
                  {shift.is_default && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/[0.12] text-brand-500">
                      <Star size={12} />
                      {lang === 'ar' ? 'افتراضي' : 'Default'}
                    </span>
                  )}
                </Td>
                <Td>
                  <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => openEdit(shift)}
                      className="p-1.5 rounded-lg text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500 transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'تعديل' : 'Edit'}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(shift.id)}
                      className="p-1.5 rounded-lg text-content-muted dark:text-content-muted-dark hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 size={15} />
                    </button>
                    {!shift.is_default && (
                      <button
                        onClick={() => handleSetDefault(shift.id)}
                        className="p-1.5 rounded-lg text-content-muted dark:text-content-muted-dark hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'تعيين كافتراضي' : 'Set as default'}
                      >
                        <Star size={15} />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId
          ? (lang === 'ar' ? 'تعديل فترة' : 'Edit Shift')
          : (lang === 'ar' ? 'إضافة فترة' : 'Add Shift')
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              placeholder="e.g. Morning Shift"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}
            </label>
            <input
              type="text"
              value={form.name_ar}
              onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
              dir="rtl"
              placeholder="مثال: الفترة الصباحية"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'بداية الدوام' : 'Official Start'}
            </label>
            <input
              type="time"
              value={form.official_start}
              onChange={e => setForm(f => ({ ...f, official_start: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'نهاية الدوام' : 'Official End'}
            </label>
            <input
              type="time"
              value={form.official_end}
              onChange={e => setForm(f => ({ ...f, official_end: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'حد التأخير' : 'Late Threshold'}
            </label>
            <input
              type="time"
              value={form.late_threshold}
              onChange={e => setForm(f => ({ ...f, late_threshold: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
        </div>
        <ModalFooter className="justify-end">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button disabled={saving || !form.name} onClick={handleSave}>
            {saving
              ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
              : (lang === 'ar' ? 'حفظ' : 'Save')
            }
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
