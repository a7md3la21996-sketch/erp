import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees } from '../../services/employeesService';
import { FileText, Plus, Trash2, Download, AlertTriangle } from 'lucide-react';
import { Button, Card, CardHeader, Table, Th, Td, Tr, Modal, ModalFooter, Select, PageSkeleton } from '../../components/ui';
import supabase from '../../lib/supabase';

const DOC_TYPES = ['contract', 'id', 'certificate', 'other'];

// Upload constraints — keep aligned with Supabase Storage bucket policy.
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_EXTS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
const ACCEPT_ATTR = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*';

const TYPE_COLORS = {
  contract: { bg: 'bg-brand-500/15', text: 'text-brand-500', border: 'border-brand-500/30' },
  id:          { bg: 'bg-emerald-500/15', text: 'text-emerald-600', border: 'border-emerald-500/30' },
  certificate: { bg: 'bg-blue-500/15', text: 'text-blue-600', border: 'border-blue-500/30' },
  other:       { bg: 'bg-gray-500/15', text: 'text-gray-500', border: 'border-gray-500/30' },
};

const TYPE_LABELS = {
  contract:    { ar: 'عقد', en: 'Contract' },
  id:          { ar: 'هوية', en: 'ID' },
  certificate: { ar: 'شهادة', en: 'Certificate' },
  other:       { ar: 'أخرى', en: 'Other' },
};

function TypeBadge({ type, lang }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.other;
  const label = TYPE_LABELS[type]?.[lang] || type;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  );
}

const EMPTY_FORM = { employee_id: '', name: '', type: 'contract', expiry_date: '', file: null };

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function DocumentsPage() {
  const { i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { showToast } = useToast();

  // Employee documents include contracts, IDs, certificates — restrict to HR/admin.
  if (profile && !['admin', 'hr'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg font-bold text-content dark:text-content-dark">
          {isRTL ? 'غير مصرح' : 'Unauthorized'}
        </p>
      </div>
    );
  }

  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  /* ─── Load data ─── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [emps, docsRes] = await Promise.all([
        fetchEmployees(),
        supabase.from('employee_documents').select('*').order('created_at', { ascending: false }),
      ]);
      setEmployees(emps);
      setDocuments(docsRes.data || []);
    } catch {
      showToast(lang === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  /* ─── Filtered documents ─── */
  const filtered = filterEmployeeId
    ? documents.filter(d => d.employee_id === filterEmployeeId)
    : documents;

  /* ─── Employee name lookup ─── */
  const empName = (id) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return '-';
    return lang === 'ar' ? (emp.full_name_ar || emp.full_name_en) : (emp.full_name_en || emp.full_name_ar);
  };

  /* ─── Upload & save ─── */
  const handleSave = async () => {
    if (!form.employee_id || !form.name || !form.file) {
      showToast(lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', 'error');
      return;
    }
    const file = form.file;
    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast(
        lang === 'ar'
          ? `حجم الملف يتعدى ${MAX_FILE_SIZE_MB} ميجا`
          : `File exceeds ${MAX_FILE_SIZE_MB} MB`,
        'error'
      );
      return;
    }
    // Extension check (defense in depth — `accept` is just a hint)
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_FILE_EXTS.includes(ext)) {
      showToast(
        lang === 'ar'
          ? 'نوع الملف غير مسموح. المسموح: PDF, DOC, DOCX, JPG, PNG, WEBP'
          : 'File type not allowed. Allowed: PDF, DOC, DOCX, JPG, PNG, WEBP',
        'error'
      );
      return;
    }
    setSaving(true);
    try {
      // Sanitize filename to keep storage paths predictable and safe.
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const filePath = `${form.employee_id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // No more `file_url` (was a permanent public URL — security hole if leaked).
      // We generate a short-lived signed URL on demand when someone clicks Download.
      const record = {
        employee_id: form.employee_id,
        name: form.name,
        type: form.type,
        file_name: file.name,
        file_path: filePath,
        expiry_date: form.expiry_date || null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('employee_documents').insert(record).select('*').single();
      if (error) throw error;

      setDocuments(prev => [data, ...prev]);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      showToast(lang === 'ar' ? 'تم رفع المستند' : 'Document uploaded', 'success');
    } catch (err) {
      console.error(err);
      showToast(lang === 'ar' ? 'فشل رفع المستند' : 'Upload failed', 'error');
    }
    setSaving(false);
  };

  /* ─── Download (generates a fresh 1-hour signed URL) ─── */
  const handleDownload = async (doc) => {
    if (!doc.file_path) {
      showToast(lang === 'ar' ? 'الملف غير موجود' : 'File path missing', 'error');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600); // 1 hour
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error(err);
      showToast(lang === 'ar' ? 'فشل توليد رابط التحميل' : 'Failed to generate download link', 'error');
    }
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    const doc = deleteTarget;
    if (!doc) return;
    try {
      // Delete from storage
      if (doc.file_path) {
        await supabase.storage.from('documents').remove([doc.file_path]);
      }
      const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      showToast(lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
    } catch (err) {
      showToast(lang === 'ar' ? 'فشل الحذف' : 'Delete failed', 'error');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="px-4 py-4 md:px-7 md:py-6"><PageSkeleton hasKpis={false} tableRows={6} tableCols={5} /></div>;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <FileText size={22} className="text-brand-500" />
          </div>
          <div className="text-start">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{lang === 'ar' ? 'مستندات الموظفين' : 'Employee Documents'}</h1>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {lang === 'ar' ? 'إدارة وتتبع مستندات الموظفين' : 'Manage and track employee documents'}
            </p>
          </div>
        </div>
        <Button size="md" onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}>
          <Plus size={16} />{lang === 'ar' ? 'رفع مستند' : 'Upload Document'}
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)}>
          <option value="">{lang === 'ar' ? 'كل الموظفين' : 'All Employees'}</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {lang === 'ar' ? (emp.full_name_ar || emp.full_name_en) : (emp.full_name_en || emp.full_name_ar)}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{lang === 'ar' ? 'الموظف' : 'Employee'}</Th>
              <Th>{lang === 'ar' ? 'اسم المستند' : 'Document Name'}</Th>
              <Th>{lang === 'ar' ? 'النوع' : 'Type'}</Th>
              <Th>{lang === 'ar' ? 'اسم الملف' : 'File Name'}</Th>
              <Th>{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</Th>
              <Th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 px-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                    <FileText size={24} className="text-brand-500" />
                  </div>
                  <p className="m-0 mb-1.5 text-sm font-bold text-content dark:text-content-dark">
                    {lang === 'ar' ? 'لا توجد مستندات' : 'No Documents'}
                  </p>
                  <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
                    {lang === 'ar' ? 'ارفع مستند جديد للبدء' : 'Upload a new document to get started'}
                  </p>
                </td>
              </tr>
            ) : filtered.map(doc => {
              const isExpired = doc.expiry_date && doc.expiry_date < today;
              return (
                <Tr key={doc.id}>
                  <Td className="font-semibold">{empName(doc.employee_id)}</Td>
                  <Td>{doc.name || '-'}</Td>
                  <Td><TypeBadge type={doc.type} lang={lang} /></Td>
                  <Td className="text-xs text-content-muted dark:text-content-muted-dark">{doc.file_name || '-'}</Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm">{doc.expiry_date || '-'}</span>
                      {isExpired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 border border-red-500/30">
                          <AlertTriangle size={12} />
                          {lang === 'ar' ? 'منتهي' : 'Expired'}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {doc.file_path && (
                        <button
                          onClick={() => handleDownload(doc)}
                          title={lang === 'ar' ? 'تحميل (لينك مؤقت ساعة)' : 'Download (1h signed URL)'}
                          className="p-1.5 rounded-lg text-content-muted hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                        >
                          <Download size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(doc)}
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                        className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* Upload Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={lang === 'ar' ? 'رفع مستند' : 'Upload Document'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Employee */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'الموظف' : 'Employee'} *</label>
            <Select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}>
              <option value="">{lang === 'ar' ? 'اختر موظف' : 'Select employee'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {lang === 'ar' ? (emp.full_name_ar || emp.full_name_en) : (emp.full_name_en || emp.full_name_ar)}
                </option>
              ))}
            </Select>
          </div>

          {/* Document name */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'اسم المستند' : 'Document Name'} *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'النوع' : 'Type'}</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {DOC_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]?.[lang] || t}</option>
              ))}
            </Select>
          </div>

          {/* Expiry date */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {lang === 'ar' ? 'الملف' : 'File'} *{' '}
              <span className="text-content-muted dark:text-content-muted-dark font-normal">
                ({lang === 'ar' ? `حد أقصى ${MAX_FILE_SIZE_MB} ميجا` : `max ${MAX_FILE_SIZE_MB} MB`})
              </span>
            </label>
            <input
              type="file"
              accept={ACCEPT_ATTR}
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
              className="w-full text-sm text-content dark:text-content-dark file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-edge dark:file:border-edge-dark file:text-xs file:font-semibold file:bg-surface-card dark:file:bg-surface-card-dark file:text-content dark:file:text-content-dark file:cursor-pointer"
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={saving || !form.employee_id || !form.name || !form.file} onClick={handleSave}>
            {saving ? (lang === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (lang === 'ar' ? 'رفع' : 'Upload')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}>
        <p className="text-sm text-content dark:text-content-dark mb-2">
          {lang === 'ar'
            ? 'سيتم حذف الملف من التخزين والسجل. لا يمكن التراجع.'
            : 'The file will be removed from storage and the database. This cannot be undone.'}
        </p>
        {deleteTarget && (
          <p className="text-xs text-content-muted dark:text-content-muted-dark">
            {deleteTarget.name} — {deleteTarget.file_name}
          </p>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" onClick={handleDelete}>{lang === 'ar' ? 'حذف' : 'Delete'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
