import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Database, Download, Upload, Trash2, HardDrive, Key,
  AlertTriangle, CheckCircle, RefreshCw, FileJson, Archive,
  Shield,
} from 'lucide-react';
import {
  downloadBackup, restoreBackup, getBackupInfo, getStorageUsage, clearAllData,
} from '../../services/backupService';

export default function BackupPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [info, setInfo] = useState({ totalKeys: 0, totalSizeKB: 0, lastBackup: null });
  const [usage, setUsage] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Restore state
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef(null);

  // Confirmation modals
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearDoubleConfirm, setShowClearDoubleConfirm] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = () => {
    setInfo(getBackupInfo());
    setUsage(getStorageUsage());
  };

  useEffect(() => { refresh(); }, []);

  // Filtered & paginated storage
  const filteredUsage = useMemo(() => {
    if (!search) return usage;
    const q = search.toLowerCase();
    return usage.filter(u => u.key.toLowerCase().includes(q));
  }, [usage, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsage.length / pageSize));
  const pagedUsage = filteredUsage.slice((page - 1) * pageSize, page * pageSize);

  const largestKey = usage.length > 0 ? usage[0] : null;

  // Estimate available space (5MB typical limit)
  const estimatedMaxKB = 5120;
  const usedPercent = Math.min(100, Math.round((info.totalSizeKB / estimatedMaxKB) * 100));

  const handleDownload = () => {
    try {
      downloadBackup();
      showToast(isRTL ? 'تم تحميل النسخة الاحتياطية بنجاح' : 'Backup downloaded successfully');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data?.version || !data?.keys) {
          setRestorePreview({ error: isRTL ? 'ملف غير صالح' : 'Invalid backup file' });
          return;
        }
        setRestorePreview({
          keys: Object.keys(data.keys).length,
          version: data.version,
          created_at: data.created_at,
          app: data.app,
        });
      } catch {
        setRestorePreview({ error: isRTL ? 'فشل قراءة الملف' : 'Failed to parse file' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    setShowRestoreConfirm(false);
    try {
      const result = await restoreBackup(restoreFile);
      setRestoreResult(result);
      showToast(
        isRTL
          ? `تم استعادة ${result.restored} مفتاح بنجاح`
          : `Restored ${result.restored} keys successfully`
      );
      refresh();
    } catch (err) {
      setRestoreResult({ restored: 0, errors: [err.message] });
      showToast(err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleClearAll = () => {
    const removed = clearAllData();
    setShowClearDoubleConfirm(false);
    setShowClearConfirm(false);
    showToast(
      isRTL
        ? `تم حذف ${removed} مفتاح`
        : `Cleared ${removed} keys`
    );
    refresh();
  };

  const formatDate = (iso) => {
    if (!iso) return isRTL ? 'لم يتم النسخ بعد' : 'Never';
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Styles ──
  const card = {
    background: isDark ? '#1a2332' : '#ffffff',
    border: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
    borderRadius: 12,
    padding: 20,
  };

  const kpiCard = (accent) => ({
    ...card,
    borderTop: `3px solid ${accent}`,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  });

  const iconWrap = (bg) => ({
    width: 42,
    height: 42,
    borderRadius: 10,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  const labelStyle = {
    margin: 0,
    fontSize: 12,
    color: isDark ? '#94a3b8' : '#64748b',
  };

  const valueStyle = {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const headingStyle = {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const subtitleStyle = {
    margin: 0,
    fontSize: 12,
    color: isDark ? '#94a3b8' : '#64748b',
  };

  const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#4A7AAB',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnDanger = {
    ...btnPrimary,
    background: '#ef4444',
  };

  const btnSecondary = {
    ...btnPrimary,
    background: isDark ? '#2a3a4e' : '#f1f5f9',
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const thStyle = {
    padding: '10px 14px',
    textAlign: isRTL ? 'right' : 'left',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: isDark ? '#94a3b8' : '#64748b',
    borderBottom: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
  };

  const tdStyle = {
    padding: '10px 14px',
    fontSize: 13,
    color: isDark ? '#e2e8f0' : '#1e293b',
    borderBottom: `1px solid ${isDark ? '#2a3a4e0a' : '#f1f5f9'}`,
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle = {
    background: isDark ? '#1a2332' : '#ffffff',
    borderRadius: 14,
    padding: 24,
    maxWidth: 440,
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      padding: '24px 28px',
      minHeight: '100vh',
      background: isDark ? '#0a1929' : '#f8fafc',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '10px 20px',
          borderRadius: 10,
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={iconWrap('rgba(74,122,171,0.12)')}>
            <Database size={20} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore'}
            </h1>
            <p style={subtitleStyle}>
              {isRTL ? 'إدارة بيانات التطبيق المحلية' : 'Manage local application data'}
            </p>
          </div>
        </div>
        <button style={btnSecondary} onClick={refresh}>
          <RefreshCw size={14} />
          {isRTL ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={kpiCard('#4A7AAB')}>
          <div style={iconWrap('rgba(74,122,171,0.12)')}>
            <HardDrive size={20} color="#4A7AAB" />
          </div>
          <div>
            <p style={labelStyle}>{isRTL ? 'الحجم الكلي' : 'Total Size'}</p>
            <p style={valueStyle}>{info.totalSizeKB} KB</p>
          </div>
        </div>

        <div style={kpiCard('#10b981')}>
          <div style={iconWrap('rgba(16,185,129,0.12)')}>
            <Key size={20} color="#10b981" />
          </div>
          <div>
            <p style={labelStyle}>{isRTL ? 'عدد المفاتيح' : 'Total Keys'}</p>
            <p style={valueStyle}>{info.totalKeys}</p>
          </div>
        </div>

        <div style={kpiCard('#f59e0b')}>
          <div style={iconWrap('rgba(245,158,11,0.12)')}>
            <Archive size={20} color="#f59e0b" />
          </div>
          <div>
            <p style={labelStyle}>{isRTL ? 'أكبر مفتاح' : 'Largest Key'}</p>
            <p style={{ ...valueStyle, fontSize: 14 }}>
              {largestKey ? `${largestKey.key.replace('platform_', '')} (${largestKey.sizeKB} KB)` : '—'}
            </p>
          </div>
        </div>

        <div style={kpiCard('#8b5cf6')}>
          <div style={iconWrap('rgba(139,92,246,0.12)')}>
            <Shield size={20} color="#8b5cf6" />
          </div>
          <div>
            <p style={labelStyle}>{isRTL ? 'المساحة المستخدمة' : 'Space Used'}</p>
            <p style={valueStyle}>{usedPercent}%</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ ...card, marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
            {isRTL ? 'استخدام التخزين' : 'Storage Usage'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {info.totalSizeKB} KB / {estimatedMaxKB} KB
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: isDark ? '#132337' : '#e2e8f0' }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            width: `${usedPercent}%`,
            background: usedPercent > 80 ? '#ef4444' : usedPercent > 50 ? '#f59e0b' : '#10b981',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Backup & Restore side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Backup */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Download size={18} color="#4A7AAB" />
            <h3 style={headingStyle}>{isRTL ? 'تحميل نسخة احتياطية' : 'Download Backup'}</h3>
          </div>
          <p style={{ ...subtitleStyle, marginBottom: 12 }}>
            {isRTL
              ? 'تحميل جميع بيانات التطبيق كملف JSON'
              : 'Download all app data as a JSON file'}
          </p>
          <p style={{ ...subtitleStyle, marginBottom: 16 }}>
            {isRTL ? 'آخر نسخة: ' : 'Last backup: '}
            <span style={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {formatDate(info.lastBackup)}
            </span>
          </p>
          <p style={{ ...subtitleStyle, marginBottom: 16 }}>
            {isRTL ? 'الحجم المقدر: ' : 'Estimated size: '}
            <span style={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {info.totalSizeKB} KB ({info.totalKeys} {isRTL ? 'مفتاح' : 'keys'})
            </span>
          </p>
          <button style={btnPrimary} onClick={handleDownload}>
            <Download size={14} />
            {isRTL ? 'تحميل النسخة' : 'Download Backup'}
          </button>
        </div>

        {/* Restore */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Upload size={18} color="#f59e0b" />
            <h3 style={headingStyle}>{isRTL ? 'استعادة نسخة احتياطية' : 'Restore Backup'}</h3>
          </div>
          <p style={{ ...subtitleStyle, marginBottom: 12 }}>
            {isRTL
              ? 'استعادة البيانات من ملف نسخة احتياطية سابقة'
              : 'Restore data from a previous backup file'}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            style={btnSecondary}
            onClick={() => fileRef.current?.click()}
          >
            <FileJson size={14} />
            {isRTL ? 'اختيار ملف' : 'Choose File'}
          </button>

          {restoreFile && (
            <p style={{ ...subtitleStyle, marginTop: 8 }}>
              {restoreFile.name}
            </p>
          )}

          {restorePreview && !restorePreview.error && (
            <div style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: isDark ? '#132337' : '#f8fafc',
              border: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
            }}>
              <p style={{ margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'معاينة:' : 'Preview:'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {restorePreview.keys} {isRTL ? 'مفتاح سيتم استعادته' : 'keys to restore'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                {isRTL ? 'الإصدار: ' : 'Version: '}{restorePreview.version} | {formatDate(restorePreview.created_at)}
              </p>
              <button
                style={{ ...btnPrimary, marginTop: 10, background: '#f59e0b' }}
                onClick={() => setShowRestoreConfirm(true)}
                disabled={restoring}
              >
                <Upload size={14} />
                {restoring
                  ? (isRTL ? 'جاري الاستعادة...' : 'Restoring...')
                  : (isRTL ? 'استعادة' : 'Restore')}
              </button>
            </div>
          )}

          {restorePreview?.error && (
            <div style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontSize: 12,
            }}>
              {restorePreview.error}
            </div>
          )}

          {restoreResult && (
            <div style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: restoreResult.errors?.length ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${restoreResult.errors?.length ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              fontSize: 12,
              color: isDark ? '#e2e8f0' : '#1e293b',
            }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {isRTL
                  ? `تم استعادة ${restoreResult.restored} مفتاح`
                  : `Restored ${restoreResult.restored} keys`}
              </p>
              {restoreResult.errors?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingInlineStart: 16, color: '#ef4444' }}>
                  {restoreResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Storage Breakdown Table */}
      <div style={{ ...card, marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={headingStyle}>
            {isRTL ? 'تفاصيل التخزين' : 'Storage Breakdown'}
          </h3>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={isRTL ? 'بحث في المفاتيح...' : 'Search keys...'}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
              background: isDark ? '#132337' : '#f8fafc',
              color: isDark ? '#e2e8f0' : '#1e293b',
              fontSize: 12,
              outline: 'none',
              width: 200,
            }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>{isRTL ? 'المفتاح' : 'Key'}</th>
                <th style={thStyle}>{isRTL ? 'الحجم' : 'Size'}</th>
                <th style={thStyle}>{isRTL ? 'العناصر' : 'Entries'}</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsage.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {isRTL ? 'لا توجد بيانات' : 'No data found'}
                  </td>
                </tr>
              ) : pagedUsage.map((u, idx) => (
                <tr key={u.key} style={{
                  background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(74,122,171,0.03)' : 'rgba(0,0,0,0.015)'),
                }}>
                  <td style={{ ...tdStyle, fontWeight: 600, width: 40 }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>
                    {u.key.replace('platform_', '')}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: u.sizeKB > 100 ? 'rgba(239,68,68,0.1)' : u.sizeKB > 10 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                      color: u.sizeKB > 100 ? '#ef4444' : u.sizeKB > 10 ? '#f59e0b' : '#10b981',
                    }}>
                      {u.sizeKB} KB
                    </span>
                  </td>
                  <td style={tdStyle}>{u.entries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsage.length > pageSize && (
          <div style={{
            padding: '10px 20px',
            borderTop: `1px solid ${isDark ? '#2a3a4e' : '#e2e8f0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
              {isRTL
                ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredUsage.length)} من ${filteredUsage.length}`
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredUsage.length)} of ${filteredUsage.length}`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...btnSecondary, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer', padding: '4px 12px', fontSize: 12 }}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                {isRTL ? 'السابق' : 'Prev'}
              </button>
              <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                style={{ ...btnSecondary, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer', padding: '4px 12px', fontSize: 12 }}
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                {isRTL ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{
        ...card,
        borderColor: 'rgba(239,68,68,0.3)',
        background: isDark ? '#1a1a2e' : '#fef2f2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={18} color="#ef4444" />
          <h3 style={{ ...headingStyle, color: '#ef4444' }}>
            {isRTL ? 'منطقة الخطر' : 'Danger Zone'}
          </h3>
        </div>
        <p style={{ ...subtitleStyle, marginBottom: 16 }}>
          {isRTL
            ? 'حذف جميع بيانات التطبيق من المتصفح. هذا الإجراء لا يمكن التراجع عنه.'
            : 'Delete all app data from the browser. This action cannot be undone.'}
        </p>
        <button style={btnDanger} onClick={() => setShowClearConfirm(true)}>
          <Trash2 size={14} />
          {isRTL ? 'حذف جميع البيانات' : 'Clear All Data'}
        </button>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div style={overlayStyle} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowRestoreConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={22} color="#f59e0b" />
              <h3 style={headingStyle}>{isRTL ? 'تأكيد الاستعادة' : 'Confirm Restore'}</h3>
            </div>
            <p style={{ ...subtitleStyle, marginBottom: 20 }}>
              {isRTL
                ? 'سيتم استبدال البيانات الحالية بالبيانات من النسخة الاحتياطية. هل أنت متأكد؟'
                : 'Current data will be overwritten with backup data. Are you sure?'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setShowRestoreConfirm(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button style={{ ...btnPrimary, background: '#f59e0b' }} onClick={handleRestore}>
                <Upload size={14} />
                {isRTL ? 'استعادة' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div style={overlayStyle} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowClearConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={22} color="#ef4444" />
              <h3 style={{ ...headingStyle, color: '#ef4444' }}>{isRTL ? 'حذف جميع البيانات' : 'Clear All Data'}</h3>
            </div>
            <p style={{ ...subtitleStyle, marginBottom: 20 }}>
              {isRTL
                ? `سيتم حذف ${info.totalKeys} مفتاح من التخزين المحلي. هذا الإجراء لا يمكن التراجع عنه.`
                : `This will delete ${info.totalKeys} keys from local storage. This cannot be undone.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setShowClearConfirm(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button style={btnDanger} onClick={() => setShowClearDoubleConfirm(true)}>
                {isRTL ? 'متأكد، احذف' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double Confirmation */}
      {showClearDoubleConfirm && (
        <div style={{ ...overlayStyle, zIndex: 210 }} dir={isRTL ? 'rtl' : 'ltr'} onClick={() => setShowClearDoubleConfirm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Trash2 size={22} color="#ef4444" />
              <h3 style={{ ...headingStyle, color: '#ef4444' }}>{isRTL ? 'تأكيد نهائي' : 'Final Confirmation'}</h3>
            </div>
            <p style={{ ...subtitleStyle, marginBottom: 20, fontWeight: 600 }}>
              {isRTL
                ? 'هل أنت متأكد تماماً؟ لا يمكن استعادة البيانات بعد الحذف!'
                : 'Are you absolutely sure? Data cannot be recovered after deletion!'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => { setShowClearDoubleConfirm(false); setShowClearConfirm(false); }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button style={btnDanger} onClick={handleClearAll}>
                <Trash2 size={14} />
                {isRTL ? 'حذف نهائي' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
