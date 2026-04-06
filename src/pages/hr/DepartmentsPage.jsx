import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDepartments } from '../../services/employeesService';
import { useToast } from '../../contexts/ToastContext';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, Table, Th, Td, Tr, Modal, ModalFooter, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

const EMPTY_FORM = { name_en: '', name_ar: '' };

export default function DepartmentsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchDepartments();
    setDepartments(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (dept) => { setEditingId(dept.id); setForm({ name_en: dept.name_en || '', name_ar: dept.name_ar || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name_en && !form.name_ar) return;
    setSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase.from('departments').update({ ...form }).eq('id', editingId).select('*').single();
        if (error) throw error;
        setDepartments(prev => prev.map(d => d.id === editingId ? data : d));
        showToast(lang === 'ar' ? 'تم التحديث' : 'Updated', 'success');
      } else {
        const { data, error } = await supabase.from('departments').insert({ ...form, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        setDepartments(prev => [...prev, data]);
        showToast(lang === 'ar' ? 'تم الإضافة' : 'Added', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast(lang === 'ar' ? 'فشل في الحفظ' : 'Save failed', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'حذف هذا القسم؟' : 'Delete this department?')) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      setDepartments(prev => prev.filter(d => d.id !== id));
      showToast(lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
    } catch {
      showToast(lang === 'ar' ? 'فشل الحذف - ممكن فيه موظفين في القسم ده' : 'Delete failed - department may have employees', 'error');
    }
  };

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis={false} tableRows={5} tableCols={4} /></div>;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex justify-between items-center mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Building2 size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'الأقسام' : 'Departments'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? 'إدارة أقسام الشركة' : 'Manage company departments'}</p>
          </div>
        </div>
        <Button size="md" onClick={openAdd}><Plus size={16} />{lang === 'ar' ? 'إضافة قسم' : 'Add Department'}</Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الاسم بالعربي' : 'Name (AR)'}</Th>
              <Th>{lang === 'ar' ? 'الاسم بالإنجليزي' : 'Name (EN)'}</Th>
              <Th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</Th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <Building2 size={24} color="#4A7AAB" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'لا توجد أقسام' : 'No Departments'}</p>
                </td>
              </tr>
            ) : departments.map(dept => (
              <Tr key={dept.id}>
                <Td className="font-bold">{dept.name_ar || '-'}</Td>
                <Td>{dept.name_en || '-'}</Td>
                <Td>
                  <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg text-content-muted hover:bg-brand-500/10 hover:text-brand-500 transition-colors"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(dept.id)} className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? (lang === 'ar' ? 'تعديل قسم' : 'Edit Department') : (lang === 'ar' ? 'إضافة قسم' : 'Add Department')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم بالعربي' : 'Name (AR)'}</label>
            <input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} dir="rtl"
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الاسم بالإنجليزي' : 'Name (EN)'}</label>
            <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm" />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={saving || (!form.name_en && !form.name_ar)} onClick={handleSave}>
            {saving ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
