import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Building2, Phone, MessageCircle, Send, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Button, Modal, ModalFooter, Input, Textarea, ListSkeleton, EmptyState , confirm } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDevelopers, createDeveloper, updateDeveloper, deleteDeveloper, canManageDevelopers } from '../../services/developersService';

const LOGO_TINTS = [
  'text-brand-600 bg-brand-500/10', 'text-emerald-600 bg-emerald-500/10',
  'text-amber-600 bg-amber-500/10', 'text-purple-600 bg-purple-500/10',
  'text-cyan-600 bg-cyan-500/10', 'text-red-600 bg-red-500/10',
];
function initials(name) {
  const p = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '؟';
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}
function tintFor(name) {
  let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return LOGO_TINTS[Math.abs(h) % LOGO_TINTS.length];
}
const cleanPhone = (p) => (p || '').replace(/[^0-9+]/g, '');
const emptyGroup = () => ({ type: 'whatsapp', url: '', label: '' });
const emptyForm = () => ({ name: '', groups: [emptyGroup()], contact_name: '', contact_phone: '', projects: '', commission: '', notes: '' });

export default function DevelopersPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  const canManage = canManageDevelopers(profile);
  const [devs, setDevs] = useState(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  const load = useCallback(async () => {
    setDevs(await fetchDevelopers());
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devs || [];
    return (devs || []).filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (Array.isArray(d.projects) && d.projects.some(p => (p || '').toLowerCase().includes(q))) ||
      (d.contact_name || '').toLowerCase().includes(q));
  }, [devs, search]);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({
      name: d.name || '',
      groups: Array.isArray(d.groups) && d.groups.length ? d.groups.map(g => ({ type: g.type || 'whatsapp', url: g.url || '', label: g.label || '' })) : [emptyGroup()],
      contact_name: d.contact_name || '', contact_phone: d.contact_phone || '',
      projects: Array.isArray(d.projects) ? d.projects.join('، ') : '',
      commission: d.commission || '', notes: d.notes || '',
    });
    setMenuFor(null);
    setModalOpen(true);
  };

  const setGroup = (i, key, val) => setForm(f => ({ ...f, groups: f.groups.map((g, gi) => gi === i ? { ...g, [key]: val } : g) }));
  const addGroupRow = () => setForm(f => ({ ...f, groups: [...f.groups, emptyGroup()] }));
  const removeGroupRow = (i) => setForm(f => ({ ...f, groups: f.groups.filter((_, gi) => gi !== i) }));

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error(isRTL ? 'اكتب اسم المطوّر' : 'Enter a developer name'); return; }
    const groups = form.groups.map(g => ({ type: g.type, url: g.url.trim(), label: g.label.trim() })).filter(g => g.url);
    if (!groups.length) { toast.error(isRTL ? 'ضيف لينك جروب واحد على الأقل' : 'Add at least one group link'); return; }
    const payload = {
      name, groups,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      projects: form.projects.split(/[،,]/).map(s => s.trim()).filter(Boolean),
      commission: form.commission.trim() || null,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    try {
      if (editing) { await updateDeveloper(editing.id, payload); toast.success(isRTL ? 'تم الحفظ' : 'Saved'); }
      else { await createDeveloper(payload); toast.success(isRTL ? 'تمت الإضافة' : 'Developer added'); }
      setModalOpen(false);
      await load();
    } catch (err) { toast.error(err.message || (isRTL ? 'فشل الحفظ' : 'Save failed')); }
    finally { setSaving(false); }
  };

  const remove = async (d) => {
    if (!await confirm(isRTL ? `حذف "${d.name}"؟` : `Delete "${d.name}"?`)) return;
    try { await deleteDeveloper(d.id); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); setMenuFor(null); await load(); }
    catch (err) { toast.error(err.message || 'Delete failed'); }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh pb-16">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="m-0 text-xl sm:text-2xl font-bold text-content dark:text-content-dark flex items-center gap-2.5">
            <Building2 size={22} className="text-brand-500" />
            {isRTL ? 'المطوّرون' : 'Developers'}
            <span className="text-[13px] font-semibold text-content-muted dark:text-content-muted-dark bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-full px-2.5 py-0.5 tabular-nums">{devs?.length ?? 0}</span>
          </h1>
          <p className="m-0 mt-1 text-xs sm:text-sm text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'كل مطوّر ولينكات جروباته في مكان واحد — اسم + لينك بس المطلوب، والباقي اختياري.' : 'Every developer and its group links in one place — only name + link required.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg px-3 h-9 min-w-[200px]">
            <Search size={15} className="text-content-muted dark:text-content-muted-dark" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? 'ابحث عن مطوّر…' : 'Search developer…'}
              className="border-0 bg-transparent outline-none text-sm text-content dark:text-content-dark w-full" />
          </div>
          {canManage && <Button variant="primary" size="sm" onClick={openAdd}><Plus size={15} /> {isRTL ? 'إضافة مطوّر' : 'Add Developer'}</Button>}
        </div>
      </div>

      {/* List */}
      {devs === null ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl">
          <EmptyState message={search ? (isRTL ? 'لا يوجد مطوّر بهذا الاسم' : 'No developer matches') : (isRTL ? 'لسه مفيش مطوّرين — ابدأ بإضافة واحد' : 'No developers yet — add your first')} />
        </div>
      ) : (
        <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-sm overflow-hidden">
          {filtered.map(d => {
            const projs = Array.isArray(d.projects) ? d.projects.filter(Boolean) : [];
            const meta = [];
            if (projs.length) meta.push(isRTL ? `${projs.length} مشروع` : `${projs.length} projects`);
            return (
              <div key={d.id} className={`flex items-center gap-3.5 px-4 py-3 border-b border-edge dark:border-edge-dark last:border-b-0 hover:bg-surface-bg dark:hover:bg-white/[0.03] transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold ${tintFor(d.name)}`}>{initials(d.name)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-content dark:text-content-dark truncate">{d.name}</div>
                  {(meta.length > 0 || d.contact_name || d.commission) && (
                    <div className="text-[11.5px] text-content-muted dark:text-content-muted-dark mt-0.5 flex items-center gap-2 flex-wrap">
                      {meta.map((m, i) => <span key={i}>{m}</span>)}
                      {d.contact_name && <span className="inline-flex items-center gap-1"><Phone size={11} className="opacity-70" />{d.contact_name}</span>}
                      {d.commission && <span>{isRTL ? 'عمولة' : 'commission'} {d.commission}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(Array.isArray(d.groups) ? d.groups : []).filter(g => g?.url).map((g, i) => {
                    const wa = g.type === 'whatsapp';
                    return (
                      <a key={i} href={g.url} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-2 rounded-lg no-underline transition-colors ${wa ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white' : 'text-cyan-600 bg-cyan-500/10 hover:bg-cyan-600 hover:text-white'}`}>
                        {wa ? <MessageCircle size={15} /> : <Send size={15} />}
                        <span className="hidden sm:inline">{wa ? 'WhatsApp' : 'Telegram'}</span>{g.label ? <span className="font-normal opacity-75 hidden md:inline"> · {g.label}</span> : null}
                      </a>
                    );
                  })}
                  {canManage && <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} className="w-8 h-8 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark flex items-center justify-center text-content-muted dark:text-content-muted-dark hover:bg-surface-bg dark:hover:bg-white/[0.05] cursor-pointer">
                      <MoreVertical size={15} />
                    </button>
                    {menuFor === d.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className={`absolute z-20 mt-1 w-36 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl shadow-lg py-1 ${isRTL ? 'start-0' : 'end-0'}`}>
                          <button onClick={() => openEdit(d)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-content dark:text-content-dark hover:bg-surface-bg dark:hover:bg-white/[0.05] cursor-pointer text-start"><Pencil size={13} /> {isRTL ? 'تعديل' : 'Edit'}</button>
                          <button onClick={() => remove(d)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer text-start"><Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}</button>
                        </div>
                      </>
                    )}
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (isRTL ? 'تعديل مطوّر' : 'Edit Developer') : (isRTL ? 'إضافة مطوّر' : 'Add Developer')} width="max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'اسم المطوّر' : 'Developer name'} <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={isRTL ? 'مثال: Tatweer Misr' : 'e.g. Tatweer Misr'} autoFocus />
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الجروبات' : 'Group links'} <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                {form.groups.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={g.type} onChange={e => setGroup(i, 'type', e.target.value)}
                      className="h-9 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-xs text-content dark:text-content-dark px-2 shrink-0">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                    </select>
                    <input value={g.url} onChange={e => setGroup(i, 'url', e.target.value)} placeholder={isRTL ? 'لينك الجروب' : 'Group link (URL)'} dir="ltr"
                      className="flex-1 min-w-0 h-9 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-xs text-content dark:text-content-dark px-2.5 outline-none" />
                    <input value={g.label} onChange={e => setGroup(i, 'label', e.target.value)} placeholder={isRTL ? 'وصف' : 'Label'}
                      className="w-20 sm:w-24 h-9 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-xs text-content dark:text-content-dark px-2 outline-none shrink-0" />
                    {form.groups.length > 1 && <button onClick={() => removeGroupRow(i)} className="w-8 h-8 rounded-lg flex items-center justify-center text-content-muted hover:text-red-500 shrink-0"><X size={15} /></button>}
                  </div>
                ))}
                <button onClick={addGroupRow} className="text-xs font-semibold text-brand-500 hover:text-brand-600 inline-flex items-center gap-1 cursor-pointer"><Plus size={13} /> {isRTL ? 'جروب تاني' : 'Another group'}</button>
              </div>
            </div>

            <details className="group">
              <summary className="text-xs font-semibold text-content-muted dark:text-content-muted-dark cursor-pointer select-none list-none flex items-center gap-1.5">
                <span className="text-brand-500 group-open:rotate-90 transition-transform inline-block">▸</span> {isRTL ? 'معلومات إضافية (اختياري)' : 'More info (optional)'}
              </summary>
              <div className="mt-3 space-y-3 ps-1">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder={isRTL ? 'اسم جهة الاتصال' : 'Contact name'} />
                  <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder={isRTL ? 'موبايل جهة الاتصال' : 'Contact phone'} inputMode="tel" dir="ltr" />
                </div>
                <Input value={form.projects} onChange={e => setForm(f => ({ ...f, projects: e.target.value }))} placeholder={isRTL ? 'المشاريع (بينهم فاصلة)' : 'Projects (comma separated)'} />
                <Input value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} placeholder={isRTL ? 'العمولة (مثال 5%)' : 'Commission (e.g. 5%)'} />
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={isRTL ? 'ملاحظات' : 'Notes'} rows={2} />
              </div>
            </details>
          </div>
          <ModalFooter>
            {editing && <Button variant="ghost" size="sm" onClick={() => remove(editing)} className="text-red-500 me-auto"><Trash2 size={14} /> {isRTL ? 'حذف' : 'Delete'}</Button>}
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="primary" size="sm" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ' : 'Save')}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
