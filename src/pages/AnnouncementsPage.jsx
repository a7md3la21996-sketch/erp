import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Pin, PinOff, Edit3, Trash2, X, Eye, Clock, User,
  AlertTriangle, ChevronDown, Bold, List, Megaphone, Check,
} from 'lucide-react';
import Pagination from '../components/ui/Pagination';
import SmartFilter, { applySmartFilters } from '../components/ui/SmartFilter';
import { useAuditFilter } from '../hooks/useAuditFilter';
import {
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  togglePin, markAsRead, getReadBy, isRead as isReadFn,
  CATEGORIES, PRIORITIES,
} from '../services/announcementService';
import { logAction } from '../services/auditService';
import { createNotification } from '../services/notificationsService';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function AnnouncementsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const userId = profile?.id || profile?.email || '';
  const isAdmin = profile?.role === 'admin';

  // ── State ──────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  const [viewAnn, setViewAnn] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [, setTick] = useState(0);

  const { auditFields, applyAuditFilters } = useAuditFilter('announcement');

  const reload = useCallback(async () => {
    const result = await getAnnouncements();
    setAnnouncements(Array.isArray(result) ? result : []);
    setTick(t => t + 1);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Listen for announcement events
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('platform_announcement', handler);
    return () => window.removeEventListener('platform_announcement', handler);
  }, [reload]);

  // ── Smart Filter fields ────────────────────────────────────────────
  const SMART_FIELDS = useMemo(() => [
    {
      id: 'category', label: 'التصنيف', labelEn: 'Category', type: 'select',
      options: Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'priority', label: 'الأولوية', labelEn: 'Priority', type: 'select',
      options: Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'pinned', label: 'مثبت', labelEn: 'Pinned', type: 'select',
      options: [{ value: 'true', label: 'مثبت', labelEn: 'Pinned' }, { value: 'false', label: 'غير مثبت', labelEn: 'Not Pinned' }],
    },
    {
      id: 'readStatus', label: 'حالة القراءة', labelEn: 'Read Status', type: 'select',
      options: [{ value: 'read', label: 'مقروء', labelEn: 'Read' }, { value: 'unread', label: 'غير مقروء', labelEn: 'Unread' }],
    },
    { id: 'created_at', label: 'تاريخ الإنشاء', labelEn: 'Created', type: 'date' },
    ...auditFields,
  ], [auditFields]);

  // ── Filtering ──────────────────────────────────────────────────────
  const enriched = useMemo(() => announcements.map(a => ({
    ...a,
    pinned: String(a.pinned),
    readStatus: isReadFn(a.id, userId) ? 'read' : 'unread',
  })), [announcements, userId]);

  const filtered = useMemo(() => {
    let data = enriched;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.titleAr || '').toLowerCase().includes(q) ||
        (a.body || '').toLowerCase().includes(q) ||
        (a.bodyAr || '').toLowerCase().includes(q) ||
        (a.author_name || '').toLowerCase().includes(q)
      );
    }
    data = applySmartFilters(data, filters.filter(f => !f.field?.startsWith('_audit_')), SMART_FIELDS);
    data = applyAuditFilters(data, filters);
    return data;
  }, [enriched, search, filters, SMART_FIELDS, applyAuditFilters]);

  // ── Pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pinnedItems = paged.filter(a => a.pinned === 'true');
  const unpinnedItems = paged.filter(a => a.pinned !== 'true');

  // ── Handlers ───────────────────────────────────────────────────────
  const handleView = (ann) => {
    setViewAnn(ann);
    if (!isReadFn(ann.id, userId)) {
      markAsRead(ann.id, userId);
      reload();
    }
  };

  const handlePin = async (ann) => {
    await togglePin(ann.id);
    logAction({ action: ann.pinned === 'true' ? 'update' : 'update', entity: 'announcement', entityId: ann.id, entityName: ann.title, description: ann.pinned === 'true' ? 'Unpinned announcement' : 'Pinned announcement', userName: profile?.full_name_en || '' });
    reload();
  };

  const handleDelete = async (ann) => {
    await deleteAnnouncement(ann.id);
    logAction({ action: 'delete', entity: 'announcement', entityId: ann.id, entityName: ann.title, description: 'Deleted announcement', userName: profile?.full_name_en || '' });
    setDeleteConfirm(null);
    reload();
  };

  const handleEdit = (ann) => {
    // Restore original pinned boolean for form
    const original = announcements.find(a => a.id === ann.id);
    setEditingAnn(original || ann);
    setShowModal(true);
  };

  const canEditDelete = (ann) => isAdmin || ann.author_id === userId;

  // ── Styles ─────────────────────────────────────────────────────────
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? '#1e3a5f30' : '#e2e8f0';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const pinnedBg = isDark ? '#132337' : '#f8fafc';

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render card ────────────────────────────────────────────────────
  const renderCard = (ann, isPinned) => {
    const cat = CATEGORIES[ann.category] || CATEGORIES.general;
    const pri = PRIORITIES[ann.priority] || PRIORITIES.normal;
    const read = ann.readStatus === 'read';
    const readByCount = getReadBy(ann.id).length;
    const title = lang === 'ar' ? (ann.titleAr || ann.title) : ann.title;
    const body = lang === 'ar' ? (ann.bodyAr || ann.body) : ann.body;

    return (
      <div
        key={ann.id}
        onClick={() => handleView(ann)}
        style={{
          background: isPinned ? pinnedBg : cardBg,
          border: `1px solid ${isPinned ? (isDark ? '#4A7AAB30' : '#4A7AAB20') : cardBorder}`,
          borderRadius: 14,
          padding: '18px 20px',
          cursor: 'pointer',
          transition: 'all 0.15s',
          position: 'relative',
          opacity: read ? 0.85 : 1,
        }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Unread dot */}
        {!read && (
          <div style={{
            position: 'absolute',
            top: 12,
            [isRTL ? 'left' : 'right']: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4A7AAB',
          }} />
        )}

        {/* Priority bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 3,
          height: '100%',
          borderRadius: isRTL ? '0 14px 14px 0' : '14px 0 0 14px',
          background: pri.color,
        }} />

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 4 }}>
              {isPinned && <Pin size={13} color="#4A7AAB" />}
              <span style={{ fontSize: 15, fontWeight: 700, color: textPrimary, lineHeight: 1.3 }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {/* Category badge */}
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                background: cat.color + '18',
                color: cat.color,
                whiteSpace: 'nowrap',
              }}>
                {lang === 'ar' ? cat.ar : cat.en}
              </span>
              {/* Priority badge */}
              {ann.priority !== 'normal' && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: pri.color + '18',
                  color: pri.color,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  {(ann.priority === 'urgent' || ann.priority === 'high') && <AlertTriangle size={10} />}
                  {lang === 'ar' ? pri.ar : pri.en}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body preview */}
        <p style={{
          margin: '0 0 10px',
          fontSize: 13,
          color: textSecondary,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: isRTL ? 'right' : 'left',
        }}>
          {body}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 11, color: textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={11} /> {ann.author_name}
            </span>
            <span style={{ fontSize: 11, color: textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {formatDate(ann.created_at)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 11, color: textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Eye size={11} /> {readByCount} {lang === 'ar' ? 'قراءة' : (readByCount === 1 ? 'read' : 'reads')}
            </span>
            {canEditDelete(ann) && (
              <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handlePin(ann)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: textSecondary, display: 'flex', alignItems: 'center',
                  }}
                  title={ann.pinned === 'true' ? 'Unpin' : 'Pin'}
                >
                  {ann.pinned === 'true' ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button
                  onClick={() => handleEdit(ann)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: textSecondary, display: 'flex', alignItems: 'center',
                  }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(ann)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: '#EF4444', display: 'flex', alignItems: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 28px', minHeight: '100vh', background: isDark ? '#0a1929' : '#f8fafc' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#4A7AAB18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={22} color="#4A7AAB" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: textPrimary }}>
              {lang === 'ar' ? 'الإعلانات' : 'Announcements'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {lang === 'ar' ? `${filtered.length} إعلان` : `${filtered.length} announcement${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingAnn(null); setShowModal(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
              borderRadius: 10, border: 'none', background: '#4A7AAB', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
          >
            <Plus size={16} />
            {lang === 'ar' ? 'إعلان جديد' : 'New Announcement'}
          </button>
        )}
      </div>

      {/* SmartFilter */}
      <SmartFilter
        fields={SMART_FIELDS}
        filters={filters}
        onFiltersChange={f => { setFilters(f); setPage(1); }}
        search={search}
        onSearchChange={v => { setSearch(v); setPage(1); }}
        searchPlaceholder={lang === 'ar' ? 'بحث في الإعلانات...' : 'Search announcements...'}
        resultsCount={filtered.length}
      />

      {/* Announcements list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Megaphone size={48} color={textSecondary} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15, color: textSecondary, fontWeight: 600 }}>
            {lang === 'ar' ? 'لا توجد إعلانات' : 'No announcements found'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {/* Pinned section */}
          {pinnedItems.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <Pin size={13} color="#4A7AAB" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB' }}>
                  {lang === 'ar' ? 'مثبت' : 'Pinned'}
                </span>
              </div>
              {pinnedItems.map(a => renderCard(a, true))}
            </>
          )}

          {/* Regular items */}
          {unpinnedItems.length > 0 && pinnedItems.length > 0 && (
            <div style={{ height: 1, background: isDark ? '#1e3a5f30' : '#e2e8f0', margin: '6px 0' }} />
          )}
          {unpinnedItems.map(a => renderCard(a, false))}
        </div>
      )}

      {/* Pagination */}
      <div style={{ marginTop: 16, background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}` }}>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          totalItems={filtered.length}
        />
      </div>

      {/* View Modal */}
      {viewAnn && (
        <ViewModal
          ann={viewAnn}
          onClose={() => setViewAnn(null)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
          userId={userId}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <AnnForm
          existing={editingAnn}
          onClose={() => { setShowModal(false); setEditingAnn(null); }}
          onSave={async (data) => {
            if (editingAnn) {
              await updateAnnouncement(editingAnn.id, data);
              logAction({ action: 'update', entity: 'announcement', entityId: editingAnn.id, entityName: data.title, description: 'Updated announcement', userName: profile?.full_name_en || '' });
            } else {
              const created = await createAnnouncement({ ...data, author: { id: userId, name: profile?.full_name_en || profile?.full_name_ar || 'Unknown' } });
              logAction({ action: 'create', entity: 'announcement', entityId: created?.id, entityName: data.title, description: 'Created announcement', userName: profile?.full_name_en || '' });
              createNotification({
                type: 'system',
                title_ar: 'إعلان جديد: ' + (data.titleAr || data.title),
                title_en: 'New Announcement: ' + data.title,
                body_ar: data.bodyAr || data.body,
                body_en: data.body,
                for_user_id: 'all',
                entity_type: 'announcement',
                entity_id: created?.id,
                from_user: profile?.full_name_en || '',
              });
            }
            setShowModal(false);
            setEditingAnn(null);
            reload();
          }}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <DeleteConfirm
          ann={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// View Modal
// ────────────────────────────────────────────────────────────────────────
function ViewModal({ ann, onClose, isDark, isRTL, lang, userId, formatDate, formatTime }) {
  const cat = CATEGORIES[ann.category] || CATEGORIES.general;
  const pri = PRIORITIES[ann.priority] || PRIORITIES.normal;
  const title = lang === 'ar' ? (ann.titleAr || ann.title) : ann.title;
  const body = lang === 'ar' ? (ann.bodyAr || ann.body) : ann.body;
  const readByList = getReadBy(ann.id);
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 600,
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 28,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, [isRTL ? 'left' : 'right']: 16,
            background: 'none', border: 'none', cursor: 'pointer', color: textSecondary,
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={20} />
        </button>

        {/* Priority bar */}
        <div style={{
          position: 'absolute', top: 0, [isRTL ? 'right' : 'left']: 0,
          width: 4, height: '100%',
          borderRadius: isRTL ? '0 16px 16px 0' : '16px 0 0 16px',
          background: pri.color,
        }} />

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: cat.color + '18', color: cat.color }}>
            {lang === 'ar' ? cat.ar : cat.en}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: pri.color + '18', color: pri.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            {(ann.priority === 'urgent' || ann.priority === 'high') && <AlertTriangle size={11} />}
            {lang === 'ar' ? pri.ar : pri.en}
          </span>
          {ann.pinned && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#4A7AAB18', color: '#4A7AAB', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pin size={11} /> {lang === 'ar' ? 'مثبت' : 'Pinned'}
            </span>
          )}
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: textPrimary, textAlign: isRTL ? 'right' : 'left' }}>
          {title}
        </h2>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={12} /> {ann.author_name}
          </span>
          <span style={{ fontSize: 12, color: textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {formatDate(ann.created_at)} {formatTime(ann.created_at)}
          </span>
        </div>

        <div style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: textPrimary,
          whiteSpace: 'pre-wrap',
          textAlign: isRTL ? 'right' : 'left',
          padding: '16px 0',
          borderTop: `1px solid ${isDark ? '#1e3a5f30' : '#e2e8f0'}`,
          borderBottom: `1px solid ${isDark ? '#1e3a5f30' : '#e2e8f0'}`,
          marginBottom: 16,
        }}>
          {body}
        </div>

        {/* Read by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Eye size={14} color={textSecondary} />
          <span style={{ fontSize: 12, color: textSecondary }}>
            {lang === 'ar'
              ? `قرأه ${readByList.length} ${readByList.length === 1 ? 'شخص' : 'أشخاص'}`
              : `Read by ${readByList.length} ${readByList.length === 1 ? 'person' : 'people'}`}
          </span>
        </div>

        {ann.expiresAt && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Clock size={14} color={textSecondary} />
            <span style={{ fontSize: 12, color: textSecondary }}>
              {lang === 'ar' ? 'ينتهي: ' : 'Expires: '}{formatDate(ann.expiresAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Create/Edit Form Modal
// ────────────────────────────────────────────────────────────────────────
function AnnForm({ existing, onClose, onSave, isDark, isRTL, lang }) {
  const [form, setForm] = useState({
    title: existing?.title || '',
    titleAr: existing?.titleAr || '',
    body: existing?.body || '',
    bodyAr: existing?.bodyAr || '',
    category: existing?.category || 'general',
    priority: existing?.priority || 'normal',
    pinned: existing?.pinned || false,
    expiresAt: existing?.expiresAt ? existing.expiresAt.slice(0, 10) : '',
  });

  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0a1929' : '#f8fafc';
  const inputBorder = isDark ? '#1e3a5f50' : '#e2e8f0';

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = () => {
    if (!form.title.trim() && !form.titleAr.trim()) return;
    onSave({
      ...form,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textPrimary,
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: textSecondary,
    marginBottom: 6,
    display: 'block',
    textAlign: isRTL ? 'right' : 'left',
  };

  return (
    <div
      onClick={onClose}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 28,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: textPrimary }}>
            {existing
              ? (lang === 'ar' ? 'تعديل الإعلان' : 'Edit Announcement')
              : (lang === 'ar' ? 'إعلان جديد' : 'New Announcement')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title EN */}
          <div>
            <label style={labelStyle}>{lang === 'ar' ? 'العنوان (إنجليزي)' : 'Title (EN)'}</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={lang === 'ar' ? 'اكتب العنوان بالإنجليزية...' : 'Enter title in English...'}
              style={inputStyle}
              dir="ltr"
            />
          </div>

          {/* Title AR */}
          <div>
            <label style={labelStyle}>{lang === 'ar' ? 'العنوان (عربي)' : 'Title (AR)'}</label>
            <input
              value={form.titleAr}
              onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))}
              placeholder={lang === 'ar' ? 'اكتب العنوان بالعربية...' : 'Enter title in Arabic...'}
              style={inputStyle}
              dir="rtl"
            />
          </div>

          {/* Body EN */}
          <div>
            <label style={labelStyle}>{lang === 'ar' ? 'المحتوى (إنجليزي)' : 'Body (EN)'}</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={lang === 'ar' ? 'اكتب المحتوى بالإنجليزية...' : 'Enter body in English...'}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
              dir="ltr"
            />
          </div>

          {/* Body AR */}
          <div>
            <label style={labelStyle}>{lang === 'ar' ? 'المحتوى (عربي)' : 'Body (AR)'}</label>
            <textarea
              value={form.bodyAr}
              onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))}
              placeholder={lang === 'ar' ? 'اكتب المحتوى بالعربية...' : 'Enter body in Arabic...'}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
              dir="rtl"
            />
          </div>

          {/* Category & Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'التصنيف' : 'Category'}</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={inputStyle}
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'الأولوية' : 'Priority'}</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={inputStyle}
              >
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pin & Expiry row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'تثبيت' : 'Pin'}</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: isRTL ? 'flex-end' : 'flex-start',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `2px solid ${form.pinned ? '#4A7AAB' : inputBorder}`,
                  background: form.pinned ? '#4A7AAB' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {form.pinned && <Check size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: textPrimary }}>
                  {lang === 'ar' ? 'تثبيت في الأعلى' : 'Pin to top'}
                </span>
              </button>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expires'}</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10,
              border: `1px solid ${inputBorder}`, background: 'transparent',
              color: textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() && !form.titleAr.trim()}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: 'none', background: '#4A7AAB', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: (!form.title.trim() && !form.titleAr.trim()) ? 0.5 : 1,
            }}
          >
            {existing
              ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
              : (lang === 'ar' ? 'نشر الإعلان' : 'Publish')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Delete Confirm
// ────────────────────────────────────────────────────────────────────────
function DeleteConfirm({ ann, onClose, onConfirm, isDark, isRTL, lang }) {
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1a2332' : '#ffffff',
          borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center',
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EF444418', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={22} color="#EF4444" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: textPrimary }}>
          {lang === 'ar' ? 'حذف الإعلان؟' : 'Delete Announcement?'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: textSecondary }}>
          {lang === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: `1px solid ${isDark ? '#1e3a5f50' : '#e2e8f0'}`,
              background: 'transparent', color: textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 24px', borderRadius: 10,
              border: 'none', background: '#EF4444', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {lang === 'ar' ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
