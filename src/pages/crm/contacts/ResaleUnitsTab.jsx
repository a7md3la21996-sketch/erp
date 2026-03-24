import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Building2, X, Save, Home, ImagePlus } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../../components/ui/';
import {
  fetchUnitsByContact, createUnit, updateUnit, deleteUnit,
} from '../../../services/resaleUnitsService';

// ── Constants ────────────────────────────────────────────────────────────────
const UNIT_TYPES = [
  { value: 'apartment',      ar: 'شقة',         en: 'Apartment' },
  { value: 'villa',          ar: 'فيلا',        en: 'Villa' },
  { value: 'duplex',         ar: 'دوبلكس',      en: 'Duplex' },
  { value: 'townhouse',      ar: 'تاون هاوس',   en: 'Townhouse' },
  { value: 'commercial',     ar: 'تجاري',       en: 'Commercial' },
  { value: 'administrative', ar: 'إداري',       en: 'Administrative' },
];

const FINISHING = [
  { value: 'full', ar: 'تشطيب كامل',   en: 'Fully Finished' },
  { value: 'semi', ar: 'نص تشطيب',     en: 'Semi Finished' },
  { value: 'none', ar: 'بدون تشطيب',   en: 'Unfinished' },
];

const STATUSES = [
  { value: 'available', ar: 'متاحة',  en: 'Available', color: '#10B981' },
  { value: 'reserved',  ar: 'محجوزة', en: 'Reserved',  color: '#F59E0B' },
  { value: 'sold',      ar: 'مباعة',  en: 'Sold',      color: '#EF4444' },
];

const statusMap = Object.fromEntries(STATUSES.map(s => [s.value, s]));
const typeMap   = Object.fromEntries(UNIT_TYPES.map(t => [t.value, t]));
const finMap    = Object.fromEntries(FINISHING.map(f => [f.value, f]));

const EMPTY_FORM = {
  project_name: '', unit_type: 'apartment', area: '', floor: '', rooms: '',
  finishing: 'full', asking_price: '', price_per_meter: '', unit_code: '',
  status: 'available', notes: '', images: [],
};

// ── Component ────────────────────────────────────────────────────────────────
export default function ResaleUnitsTab({ contact, isRTL }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    if (!contact?.id) return;
    setLoading(true);
    const data = await fetchUnitsByContact(contact.id);
    setUnits(data);
    setLoading(false);
  }, [contact?.id]);

  useEffect(() => { load(); }, [load]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (unit) => {
    setEditingId(unit.id);
    setForm({
      project_name: unit.project_name || '',
      unit_type: unit.unit_type || 'apartment',
      area: unit.area || '',
      floor: unit.floor || '',
      rooms: unit.rooms || '',
      finishing: unit.finishing || 'full',
      asking_price: unit.asking_price || '',
      price_per_meter: unit.price_per_meter || '',
      unit_code: unit.unit_code || '',
      status: unit.status || 'available',
      notes: unit.notes || '',
      images: unit.images || [],
    });
    setShowForm(true);
  };

  const generateUnitCode = () => {
    const prefix = { apartment: 'APT', villa: 'VIL', duplex: 'DPX', townhouse: 'TWN', commercial: 'COM', administrative: 'ADM' }[form.unit_type] || 'UNT';
    const num = String(Date.now()).slice(-5);
    return `${prefix}-${num}`;
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      unit_code: form.unit_code || generateUnitCode(),
      area: Number(form.area) || 0,
      rooms: Number(form.rooms) || 0,
      asking_price: Number(form.asking_price) || 0,
      price_per_meter: Number(form.price_per_meter) || 0,
      contact_id: contact.id,
      contact_name: contact.full_name || '',
    };
    if (editingId) {
      await updateUnit(editingId, payload);
    } else {
      await createUnit(payload);
    }
    setShowForm(false);
    setEditingId(null);
    load();
  };

  const handleDelete = async (id) => {
    await deleteUnit(id);
    load();
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const label = (ar, en) => isRTL ? ar : en;
  const fmtPrice = (v) => v ? Number(v).toLocaleString() : '—';

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
            <Building2 size={15} className="text-brand-500" />
            {editingId ? label('تعديل الوحدة', 'Edit Unit') : label('إضافة وحدة', 'Add Unit')}
          </h4>
          <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-brand-500/10 bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark">
            <X size={16} />
          </button>
        </div>

        {/* Project name */}
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('اسم المشروع / الكمبوند', 'Project / Compound')}</label>
          <Input value={form.project_name} onChange={e => set('project_name', e.target.value)} placeholder={label('مثال: مدينتي', 'e.g. Madinaty')} size="sm" />
        </div>

        {/* Type + Status row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('نوع الوحدة', 'Unit Type')}</label>
            <Select value={form.unit_type} onChange={e => set('unit_type', e.target.value)} size="sm">
              {UNIT_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('الحالة', 'Status')}</label>
            <Select value={form.status} onChange={e => set('status', e.target.value)} size="sm">
              {STATUSES.map(s => <option key={s.value} value={s.value}>{isRTL ? s.ar : s.en}</option>)}
            </Select>
          </div>
        </div>

        {/* Area + Floor + Rooms */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('المساحة م²', 'Area m²')}</label>
            <Input type="number" value={form.area} onChange={e => set('area', e.target.value)} size="sm" />
          </div>
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('الدور', 'Floor')}</label>
            <Input value={form.floor} onChange={e => set('floor', e.target.value)} size="sm" />
          </div>
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('الغرف', 'Rooms')}</label>
            <Input type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)} size="sm" />
          </div>
        </div>

        {/* Finishing */}
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('التشطيب', 'Finishing')}</label>
          <Select value={form.finishing} onChange={e => set('finishing', e.target.value)} size="sm">
            {FINISHING.map(f => <option key={f.value} value={f.value}>{isRTL ? f.ar : f.en}</option>)}
          </Select>
        </div>

        {/* Asking price + price per meter */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('السعر المطلوب', 'Asking Price')}</label>
            <Input type="number" value={form.asking_price} onChange={e => set('asking_price', e.target.value)} size="sm" />
          </div>
          <div>
            <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('سعر المتر', 'Price/m²')}</label>
            <Input type="number" value={form.price_per_meter} onChange={e => set('price_per_meter', e.target.value)} size="sm" />
          </div>
        </div>

        {/* Unit code */}
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('كود الوحدة (اختياري)', 'Unit Code (optional)')}</label>
          <Input value={form.unit_code} onChange={e => set('unit_code', e.target.value)} size="sm" />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('ملاحظات', 'Notes')}</label>
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} size="sm" rows={2} />
        </div>

        {/* Images */}
        <div>
          <label className="text-xs text-content-muted dark:text-content-muted-dark mb-1 block">{label('صور الوحدة', 'Unit Photos')}</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {(form.images || []).map((img, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-edge dark:border-edge-dark group">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button onClick={() => set('images', form.images.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-none cursor-pointer">
                  <X size={8} color="#fff" />
                </button>
              </div>
            ))}
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-edge dark:border-edge-dark flex items-center justify-center cursor-pointer hover:border-brand-500/50 transition-colors">
              <ImagePlus size={18} className="text-content-muted dark:text-content-muted-dark" />
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const maxSize = 500 * 1024; // 500KB per image
                files.forEach(file => {
                  if (file.size > maxSize) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setForm(prev => ({ ...prev, images: [...(prev.images || []), ev.target.result] }));
                  };
                  reader.readAsDataURL(file);
                });
                e.target.value = '';
              }} />
            </label>
          </div>
          <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{label('حد أقصى 500KB لكل صورة', 'Max 500KB per image')}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <Button variant="primary" size="sm" onClick={handleSave} className="flex-1">
            <Save size={14} />
            {editingId ? label('حفظ التعديلات', 'Save Changes') : label('إضافة', 'Add')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
            {label('إلغاء', 'Cancel')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Unit cards list ──────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
          <Building2 size={15} className="text-brand-500" />
          {label('وحدات للبيع', 'Resale Units')}
          {units.length > 0 && (
            <span className="text-[10px] bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded-full font-bold">{units.length}</span>
          )}
        </h4>
        <Button variant="primary" size="sm" onClick={openAdd}>
          <Plus size={14} />
          {label('إضافة وحدة', 'Add Unit')}
        </Button>
      </div>

      {/* Empty state */}
      {units.length === 0 && (
        <div className="text-center py-10">
          <Home size={36} className="mx-auto text-content-muted/30 dark:text-content-muted-dark/30 mb-3" />
          <p className="text-sm text-content-muted dark:text-content-muted-dark">{label('لا توجد وحدات بعد', 'No units yet')}</p>
          <p className="text-xs text-content-muted/60 dark:text-content-muted-dark/60 mt-1">{label('أضف وحدة يريد هذا العميل بيعها', 'Add a unit this contact wants to sell')}</p>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {units.map(unit => {
          const st   = statusMap[unit.status]   || statusMap.available;
          const tp   = typeMap[unit.unit_type]   || { ar: unit.unit_type, en: unit.unit_type };
          const fin  = finMap[unit.finishing]     || { ar: unit.finishing, en: unit.finishing };
          return (
            <div key={unit.id} className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-3.5 hover:shadow-md transition-shadow">
              {/* Top row: project + status */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-content dark:text-content-dark truncate">{unit.project_name || '—'}</p>
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">
                    {isRTL ? tp.ar : tp.en}
                    {unit.unit_code && <span className="text-content-muted/50 mx-1">|</span>}
                    {unit.unit_code && <span className="font-mono text-[11px]">{unit.unit_code}</span>}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.color + '18', color: st.color }}>
                  {isRTL ? st.ar : st.en}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs mb-2">
                <div>
                  <span className="text-content-muted dark:text-content-muted-dark">{label('المساحة', 'Area')}</span>
                  <p className="font-semibold text-content dark:text-content-dark">{unit.area ? `${unit.area} ${label('م²', 'm²')}` : '—'}</p>
                </div>
                <div>
                  <span className="text-content-muted dark:text-content-muted-dark">{label('الدور', 'Floor')}</span>
                  <p className="font-semibold text-content dark:text-content-dark">{unit.floor || '—'}</p>
                </div>
                <div>
                  <span className="text-content-muted dark:text-content-muted-dark">{label('الغرف', 'Rooms')}</span>
                  <p className="font-semibold text-content dark:text-content-dark">{unit.rooms || '—'}</p>
                </div>
              </div>

              {/* Finishing + Price */}
              <div className="flex items-center justify-between text-xs border-t border-edge/50 dark:border-edge-dark/50 pt-2 mt-1">
                <span className="text-content-muted dark:text-content-muted-dark">
                  {isRTL ? fin.ar : fin.en}
                </span>
                <div className="text-end">
                  <span className="font-bold text-brand-500 text-sm">{fmtPrice(unit.asking_price)}</span>
                  {unit.price_per_meter > 0 && (
                    <span className="text-content-muted dark:text-content-muted-dark ms-1.5 text-[10px]">
                      ({fmtPrice(unit.price_per_meter)}/{label('م²', 'm²')})
                    </span>
                  )}
                </div>
              </div>

              {/* Images */}
              {unit.images?.length > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {unit.images.map((img, idx) => (
                    <img key={idx} src={img} alt="" className="w-12 h-12 rounded-lg object-cover border border-edge dark:border-edge-dark shrink-0" />
                  ))}
                </div>
              )}

              {/* Notes */}
              {unit.notes && (
                <p className="text-[11px] text-content-muted dark:text-content-muted-dark mt-2 leading-relaxed line-clamp-2">{unit.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-1.5 mt-2.5 pt-2 border-t border-edge/30 dark:border-edge-dark/30">
                <button onClick={() => openEdit(unit)} className="flex items-center gap-1 text-[11px] text-brand-500 hover:bg-brand-500/10 px-2 py-1 rounded-lg bg-transparent border-none cursor-pointer transition-colors">
                  <Pencil size={12} /> {label('تعديل', 'Edit')}
                </button>
                <button onClick={() => handleDelete(unit.id)} className="flex items-center gap-1 text-[11px] text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg bg-transparent border-none cursor-pointer transition-colors">
                  <Trash2 size={12} /> {label('حذف', 'Delete')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
