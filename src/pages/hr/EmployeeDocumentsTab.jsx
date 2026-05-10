import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, AlertTriangle, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Card, Button, Modal, ModalFooter, Select } from '../../components/ui';

const DOC_TYPES = ['contract', 'id', 'certificate', 'other'];
const TYPE_LABELS = {
  contract:    { ar: 'عقد', en: 'Contract' },
  id:          { ar: 'هوية', en: 'ID' },
  certificate: { ar: 'شهادة', en: 'Certificate' },
  other:       { ar: 'أخرى', en: 'Other' },
};
const TYPE_COLORS = {
  contract: '#4A7AAB',
  id: '#10B981',
  certificate: '#6B8DB5',
  other: '#9CA3AF',
};

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_EXTS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
const ACCEPT_ATTR = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*';

export default function EmployeeDocumentsTab({ emp, isRTL, lang }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canManage = ['admin', 'hr'].includes(profile?.role);
  const today = new Date().toISOString().slice(0, 10);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'contract', expiry_date: '', file: null });

  useEffect(() => {
    if (!emp?.id) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setDocs(data || []); })
      .then(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [emp?.id]);

  const handleDownload = async (doc) => {
    if (!doc.file_path) {
      showToast(isRTL ? 'الملف غير موجود' : 'File path missing', 'error');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      showToast(isRTL ? 'فشل توليد رابط التحميل' : 'Failed to generate download link', 'error');
      if (import.meta.env.DEV) console.error(err);
    }
  };

  const handleUpload = async () => {
    if (!form.name || !form.file) {
      showToast(isRTL ? 'املأ الحقول المطلوبة' : 'Fill required fields', 'error');
      return;
    }
    if (form.file.size > MAX_FILE_SIZE_BYTES) {
      showToast(isRTL ? `حجم الملف يتعدى ${MAX_FILE_SIZE_MB} ميجا` : `File exceeds ${MAX_FILE_SIZE_MB} MB`, 'error');
      return;
    }
    const ext = (form.file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_FILE_EXTS.includes(ext)) {
      showToast(isRTL ? 'نوع الملف غير مسموح' : 'File type not allowed', 'error');
      return;
    }
    setUploading(true);
    try {
      const safeName = form.file.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const filePath = `${emp.id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, form.file);
      if (uploadErr) throw uploadErr;

      const record = {
        employee_id: emp.id,
        name: form.name,
        type: form.type,
        file_name: form.file.name,
        file_path: filePath,
        expiry_date: form.expiry_date || null,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('employee_documents').insert(record).select('*').single();
      if (error) throw error;

      setDocs(prev => [data, ...prev]);
      setForm({ name: '', type: 'contract', expiry_date: '', file: null });
      setUploadOpen(false);
      showToast(isRTL ? 'تم رفع المستند' : 'Document uploaded', 'success');
    } catch (err) {
      showToast(isRTL ? 'فشل الرفع' : 'Upload failed', 'error');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.file_path) {
        await supabase.storage.from('documents').remove([deleteTarget.file_path]);
      }
      const { error } = await supabase.from('employee_documents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id));
      showToast(isRTL ? 'تم الحذف' : 'Deleted', 'success');
    } catch (err) {
      showToast(isRTL ? 'فشل الحذف' : 'Delete failed', 'error');
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <Card className="p-8 text-center text-xs text-content-muted">جاري التحميل...</Card>;

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-3.5 border-b border-edge dark:border-edge-dark flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <FileText size={16} className="text-brand-500" />
          <p className="m-0 text-sm font-bold text-content dark:text-content-dark">
            {isRTL ? 'مستندات الموظف' : 'Documents'}
          </p>
          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">({docs.length})</span>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus size={13} />
            {isRTL ? 'رفع' : 'Upload'}
          </Button>
        )}
      </div>

      <div className="px-5 py-3">
        {docs.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
              <FileText size={22} className="text-brand-500" />
            </div>
            <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? 'لا يوجد مستندات لهذا الموظف' : 'No documents on file'}
            </p>
            {canManage && (
              <p className="m-0 mt-1 text-[10px] text-content-muted dark:text-content-muted-dark">
                {isRTL ? 'اضغط "رفع" لإضافة أول مستند' : 'Click "Upload" to add the first one'}
              </p>
            )}
          </div>
        ) : docs.map(doc => {
          const isExpired = doc.expiry_date && doc.expiry_date < today;
          const typeColor = TYPE_COLORS[doc.type] || TYPE_COLORS.other;
          return (
            <div
              key={doc.id}
              className={`flex items-center gap-3 py-3 border-b border-edge/50 dark:border-edge-dark/50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${typeColor}18` }}>
                <FileText size={16} style={{ color: typeColor }} />
              </div>
              <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <p className="m-0 text-xs font-bold text-content dark:text-content-dark truncate">{doc.name}</p>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}35` }}
                  >
                    {TYPE_LABELS[doc.type]?.[lang] || doc.type}
                  </span>
                  {isExpired && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-600 border border-red-500/30">
                      <AlertTriangle size={10} />
                      {isRTL ? 'منتهي' : 'Expired'}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-0.5 text-[10px] text-content-muted dark:text-content-muted-dark">
                  {doc.file_name}
                  {doc.expiry_date ? ` · ${isRTL ? 'تنتهي' : 'expires'} ${doc.expiry_date}` : ''}
                </p>
              </div>
              <div className={`flex items-center gap-1 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => handleDownload(doc)}
                  title={isRTL ? 'تحميل' : 'Download'}
                  className="p-1.5 rounded-lg text-content-muted hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
                >
                  <Download size={14} />
                </button>
                {canManage && (
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    title={isRTL ? 'حذف' : 'Delete'}
                    className="p-1.5 rounded-lg text-content-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canManage && (
        <div className="px-5 py-3 border-t border-edge dark:border-edge-dark text-center">
          <Link to="/hr/documents" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:underline">
            <ExternalLink size={11} />
            {isRTL ? 'إدارة كل مستندات الشركة' : 'Manage all company documents'}
          </Link>
        </div>
      )}

      {/* ── Upload Modal ── */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={isRTL ? 'رفع مستند' : 'Upload Document'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'اسم المستند' : 'Document Name'} *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النوع' : 'Type'}</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {DOC_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]?.[lang] || t}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">
              {isRTL ? 'الملف' : 'File'} *
              <span className="font-normal"> ({isRTL ? `حد أقصى ${MAX_FILE_SIZE_MB} ميجا` : `max ${MAX_FILE_SIZE_MB} MB`})</span>
            </label>
            <input
              type="file"
              accept={ACCEPT_ATTR}
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
              className="w-full text-sm text-content dark:text-content-dark file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-edge file:text-xs file:font-semibold file:bg-surface-card file:text-content file:cursor-pointer"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setUploadOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button disabled={uploading || !form.name || !form.file} onClick={handleUpload}>
            {uploading ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'رفع' : 'Upload')}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}>
        <p className="text-sm text-content dark:text-content-dark mb-2">
          {isRTL ? 'سيتم حذف الملف من التخزين والسجل. لا يمكن التراجع.' : 'The file will be removed. This cannot be undone.'}
        </p>
        {deleteTarget && (
          <p className="text-xs text-content-muted dark:text-content-muted-dark">{deleteTarget.name}</p>
        )}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" onClick={handleDelete}>{isRTL ? 'حذف' : 'Delete'}</Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
}
