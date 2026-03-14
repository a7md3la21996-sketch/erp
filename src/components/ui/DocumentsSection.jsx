import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { FileText, Plus, Trash2, X, Upload, File, FileCheck } from 'lucide-react';
import {
  getDocumentsByEntity, addDocument, deleteDocument,
  DOCUMENT_TYPES, DOC_TYPE_COLORS, formatFileSize,
} from '../../services/documentService';
import { logAction } from '../../services/auditService';

/**
 * Reusable Documents Section for drawers
 * @param {{ entity: string, entityId: string|number, entityName: string }} props
 */
export default function DocumentsSection({ entity, entityId, entityName }) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [documents, setDocuments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'other', notes: '', fileName: '', fileSize: 0, fileType: '' });

  // Load documents
  useEffect(() => {
    setDocuments(getDocumentsByEntity(entity, entityId));
    setShowAddForm(false);
    setConfirmDeleteId(null);
    setForm({ name: '', type: 'other', notes: '', fileName: '', fileSize: 0, fileType: '' });
  }, [entity, entityId]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm(f => ({
        ...f,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        name: f.name || file.name.replace(/\.[^/.]+$/, ''),
      }));
    }
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const doc = addDocument({
      name: form.name.trim(),
      type: form.type,
      entity,
      entity_id: entityId,
      entity_name: entityName,
      file_name: form.fileName || form.name.trim(),
      file_size: form.fileSize,
      file_type: form.fileType,
      notes: form.notes.trim(),
    });
    setDocuments(prev => [doc, ...prev]);
    setShowAddForm(false);
    setForm({ name: '', type: 'other', notes: '', fileName: '', fileSize: 0, fileType: '' });
    logAction({
      action: 'create',
      entity: 'document',
      entityId: doc.id,
      entityName: doc.name,
      description: `${isRTL ? 'تم إضافة مستند' : 'Document added'}: ${doc.name} → ${entity} ${entityName}`,
    });
  };

  const handleDelete = (id) => {
    const removed = deleteDocument(id);
    if (removed) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      logAction({
        action: 'delete',
        entity: 'document',
        entityId: id,
        entityName: removed.name,
        description: `${isRTL ? 'تم حذف مستند' : 'Document deleted'}: ${removed.name} → ${entity} ${entityName}`,
      });
    }
    setConfirmDeleteId(null);
  };

  // ── Styles ───────────────────────────────────────────────────────
  const sectionBg = isDark ? '#132337' : '#f8fafc';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)';
  const accent = '#4A7AAB';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} color={accent} />
          {isRTL ? 'المستندات' : 'Documents'}
          {documents.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: `${accent}18`, padding: '1px 8px', borderRadius: 10 }}>
              {documents.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setShowAddForm(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, color: accent,
            background: `${accent}15`, border: `1px solid ${accent}30`,
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {showAddForm ? <X size={11} /> : <Plus size={11} />}
          {showAddForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'إضافة' : 'Add')}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{
          background: `${accent}08`, border: `1px solid ${accent}20`,
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          {/* Document Name */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>
              {isRTL ? 'اسم المستند' : 'Document Name'} <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={isRTL ? 'مثال: عقد بيع شقة...' : 'e.g. Apartment Sale Contract...'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${borderColor}`,
                background: cardBg, color: textPrimary,
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
                direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left',
              }}
            />
          </div>

          {/* Type Selector */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>
              {isRTL ? 'النوع' : 'Type'}
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DOCUMENT_TYPES.map(dt => {
                const isActive = form.type === dt.id;
                const color = DOC_TYPE_COLORS[dt.id] || '#6B7280';
                return (
                  <button
                    key={dt.id}
                    onClick={() => setForm(f => ({ ...f, type: dt.id }))}
                    style={{
                      padding: '4px 10px', borderRadius: 8,
                      fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                      border: `1px solid ${isActive ? color : borderColor}`,
                      background: isActive ? `${color}18` : 'transparent',
                      color: isActive ? color : textSecondary,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isRTL ? dt.ar : dt.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulated File Picker */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>
              {isRTL ? 'الملف' : 'File'}
            </label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8,
              border: `1px dashed ${form.fileName ? accent : borderColor}`,
              background: form.fileName ? `${accent}08` : 'transparent',
              cursor: 'pointer',
            }}>
              <Upload size={14} color={form.fileName ? accent : textSecondary} />
              <span style={{ fontSize: 11, color: form.fileName ? textPrimary : textSecondary, flex: 1 }}>
                {form.fileName || (isRTL ? 'اختر ملف...' : 'Choose file...')}
              </span>
              {form.fileSize > 0 && (
                <span style={{ fontSize: 10, color: textSecondary }}>{formatFileSize(form.fileSize)}</span>
              )}
              <input type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
            </label>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>
              {isRTL ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', borderRadius: 8,
                border: `1px solid ${borderColor}`,
                background: cardBg, color: textPrimary,
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
                resize: 'vertical', minHeight: 40,
                direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left',
              }}
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleAdd}
            disabled={!form.name.trim()}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8,
              border: 'none', cursor: form.name.trim() ? 'pointer' : 'not-allowed',
              background: form.name.trim() ? accent : `${accent}40`,
              color: '#fff', fontSize: 12, fontWeight: 700,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <FileCheck size={13} />
            {isRTL ? 'حفظ المستند' : 'Save Document'}
          </button>
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 && !showAddForm ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: textSecondary }}>
          <FileText size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 12 }}>{isRTL ? 'لا توجد مستندات بعد' : 'No documents yet'}</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.7 }}>
            {isRTL ? 'أضف مستند باستخدام الزر أعلاه' : 'Add a document using the button above'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(doc => {
            const typeColor = DOC_TYPE_COLORS[doc.type] || '#6B7280';
            const typeLabel = DOCUMENT_TYPES.find(t => t.id === doc.type);
            const isConfirmingDelete = confirmDeleteId === doc.id;

            return (
              <div
                key={doc.id}
                style={{
                  background: `${typeColor}08`, border: `1px solid ${typeColor}18`,
                  borderRadius: 12, padding: '12px 14px',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${typeColor}15`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <File size={15} color={typeColor} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.name}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: typeColor,
                        background: `${typeColor}15`, padding: '1px 6px', borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}>
                        {typeLabel ? (isRTL ? typeLabel.ar : typeLabel.en) : doc.type}
                      </span>
                    </div>
                    {doc.file_name && doc.file_name !== doc.name && (
                      <p style={{ margin: 0, fontSize: 10, color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.file_name}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 10, color: textSecondary }}>
                      {doc.file_size > 0 && <span>{formatFileSize(doc.file_size)}</span>}
                      <span>{new Date(doc.uploaded_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {doc.notes && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: textSecondary, lineHeight: 1.4 }}>
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  <div style={{ flexShrink: 0 }}>
                    {isConfirmingDelete ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          style={{
                            padding: '3px 8px', borderRadius: 6,
                            border: '1px solid #EF4444', background: '#EF444418',
                            color: '#EF4444', fontSize: 10, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {isRTL ? 'تأكيد' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: '3px 8px', borderRadius: 6,
                            border: `1px solid ${borderColor}`, background: 'transparent',
                            color: textSecondary, fontSize: 10, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {isRTL ? 'لا' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        title={isRTL ? 'حذف' : 'Delete'}
                        style={{
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', padding: 4, borderRadius: 6,
                          color: textSecondary, opacity: 0.5,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
