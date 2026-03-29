import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Home, Package, CheckCircle, Clock, X, Building2, Maximize2, BedDouble, Eye, Layers, ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import { KpiCard, SmartFilter, applySmartFilters, ExportButton, Pagination, Button, Input, Select, Textarea } from '../../components/ui';
import { fmtMoney } from '../../utils/formatting';
import { thCls, tdCls } from '../../utils/tableStyles';
import { useEscClose } from '../../utils/hooks';

// ── Storage ──────────────────────────────────────────────────
const STORAGE_KEY = 'platform_re_units';

// ── Status Config ────────────────────────────────────────────
const UNIT_STATUS_CONFIG = {
  available:          { ar: 'متاح',       en: 'Available',          color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  reserved:           { ar: 'محجوز',      en: 'Reserved',           color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  sold:               { ar: 'مباع',       en: 'Sold',               color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  under_construction: { ar: 'تحت الإنشاء', en: 'Under Construction', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
};

const UNIT_TYPE_CONFIG = {
  apartment:     { ar: 'شقة',       en: 'Apartment',     code: 'APT' },
  villa:         { ar: 'فيلا',      en: 'Villa',         code: 'VIL' },
  duplex:        { ar: 'دوبلكس',    en: 'Duplex',        code: 'DPX' },
  townhouse:     { ar: 'تاون هاوس', en: 'Townhouse',     code: 'TWN' },
  commercial:    { ar: 'تجاري',     en: 'Commercial',    code: 'COM' },
  administrative:{ ar: 'إداري',     en: 'Administrative',code: 'ADM' },
  penthouse:     { ar: 'بنتهاوس',   en: 'Penthouse',     code: 'PNT' },
  studio:        { ar: 'استوديو',   en: 'Studio',        code: 'STD' },
};

const VIEW_CONFIG = {
  garden:    { ar: 'حديقة',       en: 'Garden' },
  pool:      { ar: 'حمام سباحة',  en: 'Pool' },
  street:    { ar: 'شارع',        en: 'Street' },
  landscape: { ar: 'لاند سكيب',   en: 'Landscape' },
  lake:      { ar: 'بحيرة',       en: 'Lake' },
  corner:    { ar: 'ركنية',       en: 'Corner' },
  open:      { ar: 'مفتوح',       en: 'Open View' },
};

const FINISHING_CONFIG = {
  full: { ar: 'تشطيب كامل', en: 'Full Finishing' },
  semi: { ar: 'نصف تشطيب',  en: 'Semi Finishing' },
  none: { ar: 'بدون تشطيب', en: 'No Finishing' },
};

// ── Mock Units ───────────────────────────────────────────────
const DEFAULT_UNITS = [
  { id: 'u1',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-101', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 150, floor: '1', bedrooms: 3, bathrooms: 2, price: 3500000, status: 'available',          view: 'garden',    finishing: 'full', notes: '', created_at: '2025-06-15' },
  { id: 'u2',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-204', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 120, floor: '2', bedrooms: 2, bathrooms: 1, price: 2800000, status: 'reserved',           view: 'street',    finishing: 'semi', notes: '', created_at: '2025-06-20' },
  { id: 'u3',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'B-501', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 180, floor: '5', bedrooms: 3, bathrooms: 2, price: 4500000, status: 'sold',               view: 'landscape', finishing: 'full', notes: '', created_at: '2025-07-01' },
  { id: 'u4',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'C-302', type_ar: 'دوبلكس',    type_en: 'Duplex',    type: 'duplex',    area: 250, floor: '3', bedrooms: 4, bathrooms: 3, price: 5500000, status: 'sold',               view: 'garden',    finishing: 'full', notes: '', created_at: '2025-07-10' },
  { id: 'u5',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-712', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 160, floor: '7', bedrooms: 3, bathrooms: 2, price: 3800000, status: 'sold',               view: 'open',      finishing: 'semi', notes: '', created_at: '2025-07-15' },
  { id: 'u6',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'PH-01', type_ar: 'بنتهاوس',   type_en: 'Penthouse', type: 'penthouse', area: 320, floor: '10', bedrooms: 4, bathrooms: 3, price: 8000000, status: 'available',          view: 'open',      finishing: 'full', notes: '', created_at: '2025-08-01' },
  { id: 'u7',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'A-410', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 130, floor: '4', bedrooms: 2, bathrooms: 1, price: 1800000, status: 'sold',               view: 'pool',      finishing: 'full', notes: '', created_at: '2025-08-10' },
  { id: 'u8',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'B-108', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 140, floor: '1', bedrooms: 2, bathrooms: 2, price: 2100000, status: 'sold',               view: 'garden',    finishing: 'semi', notes: '', created_at: '2025-08-15' },
  { id: 'u9',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'V-12',  type_ar: 'فيلا',      type_en: 'Villa',     type: 'villa',     area: 350, floor: '0', bedrooms: 5, bathrooms: 4, price: 7200000, status: 'reserved',           view: 'landscape', finishing: 'full', notes: '', created_at: '2025-09-01' },
  { id: 'u10', project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'C-305', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 155, floor: '3', bedrooms: 3, bathrooms: 2, price: 2400000, status: 'available',          view: 'pool',      finishing: 'full', notes: '', created_at: '2025-09-10' },
  { id: 'u11', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'TH-03', type_ar: 'تاون هاوس', type_en: 'Townhouse', type: 'townhouse', area: 220, floor: '0', bedrooms: 4, bathrooms: 3, price: 4100000, status: 'sold',               view: 'corner',    finishing: 'full', notes: '', created_at: '2025-09-20' },
  { id: 'u12', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'TH-08', type_ar: 'تاون هاوس', type_en: 'Townhouse', type: 'townhouse', area: 200, floor: '0', bedrooms: 3, bathrooms: 2, price: 3200000, status: 'reserved',           view: 'garden',    finishing: 'semi', notes: '', created_at: '2025-10-01' },
  { id: 'u13', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'A-201', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 110, floor: '2', bedrooms: 2, bathrooms: 1, price: 2200000, status: 'available',          view: 'street',    finishing: 'none', notes: '', created_at: '2025-10-10' },
  { id: 'u14', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'D-105', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 165, floor: '1', bedrooms: 3, bathrooms: 2, price: 3200000, status: 'available',          view: 'landscape', finishing: 'full', notes: '', created_at: '2025-10-20' },
  { id: 'u15', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'V-05',  type_ar: 'فيلا',      type_en: 'Villa',     type: 'villa',     area: 400, floor: '0', bedrooms: 5, bathrooms: 4, price: 9000000, status: 'under_construction', view: 'lake',      finishing: 'none', notes: '', created_at: '2025-11-01' },
  { id: 'u16', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'S-301', type_ar: 'استوديو',   type_en: 'Studio',    type: 'studio',    area: 55,  floor: '3', bedrooms: 0, bathrooms: 1, price: 2000000, status: 'available',          view: 'open',      finishing: 'semi', notes: '', created_at: '2025-11-10' },
  { id: 'u17', project_id: 'p7',  project_ar: 'هايد بارك',      project_en: 'Hyde Park',          unit_code: 'HP-210', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 190, floor: '2', bedrooms: 3, bathrooms: 2, price: 5500000, status: 'available',          view: 'garden',    finishing: 'full', notes: '', created_at: '2025-11-20' },
  { id: 'u18', project_id: 'p7',  project_ar: 'هايد بارك',      project_en: 'Hyde Park',          unit_code: 'HP-V03', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 500, floor: '0', bedrooms: 6, bathrooms: 5, price: 18000000, status: 'reserved',          view: 'lake',      finishing: 'full', notes: '', created_at: '2025-12-01' },
  { id: 'u19', project_id: 'p9',  project_ar: 'بالم هيلز',      project_en: 'Palm Hills NC',      unit_code: 'PH-C12', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 100, floor: '1', bedrooms: 2, bathrooms: 1, price: 6000000, status: 'available',          view: 'pool',      finishing: 'full', notes: '', created_at: '2025-12-10' },
  { id: 'u20', project_id: 'p9',  project_ar: 'بالم هيلز',      project_en: 'Palm Hills NC',      unit_code: 'PH-V01', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 300, floor: '0', bedrooms: 4, bathrooms: 3, price: 25000000, status: 'sold',              view: 'landscape', finishing: 'full', notes: '', created_at: '2025-12-20' },
  { id: 'u21', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'D-105', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 90,  floor: '1', bedrooms: 2, bathrooms: 1, price: 1350000, status: 'sold',               view: 'street',    finishing: 'semi', notes: '', created_at: '2026-01-05' },
  { id: 'u22', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'E-203', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 100, floor: '2', bedrooms: 2, bathrooms: 1, price: 1650000, status: 'reserved',           view: 'garden',    finishing: 'full', notes: '', created_at: '2026-01-15' },
  { id: 'u23', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'F-101', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 85,  floor: '1', bedrooms: 2, bathrooms: 1, price: 950000,  status: 'available',          view: 'street',    finishing: 'none', notes: '', created_at: '2026-01-25' },
  { id: 'u24', project_id: 'p4',  project_ar: 'ال بوسكو',       project_en: 'IL Bosco',           unit_code: 'IB-401', type_ar: 'دوبلكس',   type_en: 'Duplex',    type: 'duplex',    area: 280, floor: '4', bedrooms: 4, bathrooms: 3, price: 8500000, status: 'sold',               view: 'landscape', finishing: 'full', notes: '', created_at: '2026-02-01' },
  { id: 'u25', project_id: 'p4',  project_ar: 'ال بوسكو',       project_en: 'IL Bosco',           unit_code: 'IB-PH2', type_ar: 'بنتهاوس',  type_en: 'Penthouse', type: 'penthouse', area: 350, floor: '12', bedrooms: 5, bathrooms: 4, price: 12000000, status: 'sold',              view: 'open',      finishing: 'full', notes: '', created_at: '2026-02-10' },
  { id: 'u26', project_id: 'p8',  project_ar: 'سوديك ايست',     project_en: 'Sodic East',         unit_code: 'SE-101', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 170, floor: '1', bedrooms: 3, bathrooms: 2, price: 5500000, status: 'under_construction', view: 'garden',    finishing: 'none', notes: '', created_at: '2026-02-20' },
  { id: 'u27', project_id: 'p8',  project_ar: 'سوديك ايست',     project_en: 'Sodic East',         unit_code: 'SE-V01', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 450, floor: '0', bedrooms: 5, bathrooms: 4, price: 20000000, status: 'under_construction', view: 'corner',    finishing: 'none', notes: '', created_at: '2026-03-01' },
  { id: 'u28', project_id: 'p6',  project_ar: 'ماونتن فيو',     project_en: 'Mountain View iCity', unit_code: 'MV-305', type_ar: 'شقة',     type_en: 'Apartment', type: 'apartment', area: 175, floor: '3', bedrooms: 3, bathrooms: 2, price: 6500000, status: 'sold',               view: 'landscape', finishing: 'full', notes: '', created_at: '2026-03-10' },
];

function loadUnits() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_UNITS));
  return [...DEFAULT_UNITS];
}

function loadProjects() {
  return [];
}

function generateUnitCode(type) {
  const cfg = UNIT_TYPE_CONFIG[type];
  const prefix = cfg ? cfg.code : 'UNT';
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}

function generateId() {
  return `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const EMPTY_FORM = {
  project_id: '',
  unit_number: '',
  type: 'apartment',
  area: '',
  floor: '',
  rooms: '',
  bathrooms: '',
  finishing: 'full',
  price: '',
  status: 'available',
  notes: '',
};

// ── Main Component ───────────────────────────────────────────
export default function UnitsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [units, setUnits] = useState(() => loadUnits());
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // CRUD state
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const projects = useMemo(() => loadProjects(), []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  }, [units]);

  // Open add form
  const handleAdd = useCallback(() => {
    setEditingUnit(null);
    setFormData({ ...EMPTY_FORM });
    setShowForm(true);
  }, []);

  // Open edit form
  const handleEdit = useCallback((unit, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setEditingUnit(unit);
    setFormData({
      project_id: unit.project_id || '',
      unit_number: unit.unit_code || '',
      type: unit.type || 'apartment',
      area: unit.area || '',
      floor: unit.floor != null ? String(unit.floor) : '',
      rooms: unit.bedrooms != null ? String(unit.bedrooms) : '',
      bathrooms: unit.bathrooms != null ? String(unit.bathrooms) : '',
      finishing: unit.finishing || 'full',
      price: unit.price || '',
      status: unit.status || 'available',
      notes: unit.notes || '',
    });
    setShowForm(true);
  }, []);

  // Save (create or update)
  const handleSave = useCallback(() => {
    const typeCfg = UNIT_TYPE_CONFIG[formData.type];
    const unitCode = formData.unit_number.trim() || generateUnitCode(formData.type);

    // Find project info
    let projectAr = '';
    let projectEn = '';
    if (formData.project_id) {
      const proj = projects.find(p => p.id === formData.project_id);
      if (proj) {
        projectAr = proj.name_ar || proj.name || '';
        projectEn = proj.name_en || proj.name || '';
      }
      // Also check if it's from default units project
      if (!projectAr && !projectEn) {
        const existingUnit = (units || []).find(u => u.project_id === formData.project_id);
        if (existingUnit) {
          projectAr = existingUnit.project_ar || '';
          projectEn = existingUnit.project_en || '';
        }
      }
    }

    const unitData = {
      project_id: formData.project_id,
      project_ar: projectAr,
      project_en: projectEn,
      unit_code: unitCode,
      type: formData.type,
      type_ar: typeCfg ? typeCfg.ar : '',
      type_en: typeCfg ? typeCfg.en : '',
      area: Number(formData.area) || 0,
      floor: formData.floor,
      bedrooms: Number(formData.rooms) || 0,
      bathrooms: Number(formData.bathrooms) || 0,
      finishing: formData.finishing,
      price: Number(formData.price) || 0,
      status: formData.status,
      notes: formData.notes || '',
    };

    if (editingUnit) {
      // Update
      setUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, ...unitData } : u));
    } else {
      // Create
      const newUnit = {
        id: generateId(),
        ...unitData,
        view: '',
        created_at: new Date().toISOString().slice(0, 10),
      };
      setUnits(prev => [newUnit, ...prev]);
    }

    setShowForm(false);
    setEditingUnit(null);
    setFormData({ ...EMPTY_FORM });
  }, [formData, editingUnit, projects, units]);

  // Delete
  const handleDelete = useCallback((unit, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setDeleteConfirm(unit);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      setUnits(prev => prev.filter(u => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      if (selectedUnit && selectedUnit.id === deleteConfirm.id) {
        setSelectedUnit(null);
      }
    }
  }, [deleteConfirm, selectedUnit]);

  // SmartFilter field definitions
  const filterFields = useMemo(() => [
    {
      id: 'project_en',
      label: 'المشروع',
      labelEn: 'Project',
      type: 'select',
      options: [...new Set(units.map(u => u.project_en))].filter(Boolean).map(p => {
        const u = (units || []).find(x => x.project_en === p);
        return { value: p, label: u?.project_ar || p, labelEn: p };
      }),
    },
    {
      id: 'type',
      label: 'النوع',
      labelEn: 'Type',
      type: 'select',
      options: Object.entries(UNIT_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'status',
      label: 'الحالة',
      labelEn: 'Status',
      type: 'select',
      options: Object.entries(UNIT_STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.ar, labelEn: v.en })),
    },
    {
      id: 'bedrooms',
      label: 'غرف النوم',
      labelEn: 'Bedrooms',
      type: 'number',
    },
    {
      id: 'price',
      label: 'السعر',
      labelEn: 'Price',
      type: 'number',
    },
    {
      id: 'created_at',
      label: 'التاريخ',
      labelEn: 'Date',
      type: 'date',
    },
  ], [units]);

  const filtered = useMemo(() => {
    let result = [...units];

    // Text search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(u =>
        (u.unit_code || '').toLowerCase().includes(s) ||
        (u.project_ar || '').includes(s) ||
        (u.project_en || '').toLowerCase().includes(s) ||
        (u.type_ar || '').includes(s) ||
        (u.type_en || '').toLowerCase().includes(s)
      );
    }

    // SmartFilter
    if (filters.length) {
      result = applySmartFilters(result, filters, filterFields);
    }

    return result;
  }, [units, search, filters, filterFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [filters, search, pageSize]);

  // KPI values
  const kpis = useMemo(() => ({
    total: (units || []).length,
    available: (units || []).filter(u => u.status === 'available').length,
    reserved: (units || []).filter(u => u.status === 'reserved').length,
    sold: (units || []).filter(u => u.status === 'sold').length,
  }), [units]);

  // Unique project list from units (for dropdown when no platform_projects)
  const projectOptions = useMemo(() => {
    if (projects.length > 0) {
      return projects.map(p => ({
        id: p.id,
        ar: p.name_ar || p.name || '',
        en: p.name_en || p.name || '',
      }));
    }
    // Fallback: extract unique projects from existing units
    const map = new Map();
    (units || []).forEach(u => {
      if (u.project_id && !map.has(u.project_id)) {
        map.set(u.project_id, { id: u.project_id, ar: u.project_ar || '', en: u.project_en || '' });
      }
    });
    return [...map.values()];
  }, [projects, units]);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/10">
            <Home size={22} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content dark:text-content-dark m-0">
              {isRTL ? 'الوحدات العقارية' : 'Real Estate Units'}
            </h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
              {isRTL ? 'مخزون الوحدات وتفاصيلها' : 'Units inventory & details'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" onClick={handleAdd}>
            <Plus size={16} />
            {isRTL ? 'إضافة وحدة' : 'Add Unit'}
          </Button>
          <ExportButton
            data={filtered}
            filename="units"
            title={isRTL ? 'الوحدات العقارية' : 'Real Estate Units'}
            columns={[
              { key: 'unit_code', label: isRTL ? 'كود الوحدة' : 'Unit Code' },
              { key: isRTL ? 'project_ar' : 'project_en', label: isRTL ? 'المشروع' : 'Project' },
              { key: isRTL ? 'type_ar' : 'type_en', label: isRTL ? 'النوع' : 'Type' },
              { key: 'area', label: isRTL ? 'المساحة' : 'Area' },
              { key: 'bedrooms', label: isRTL ? 'غرف' : 'Beds' },
              { key: 'price', label: isRTL ? 'السعر' : 'Price' },
              { key: 'status', label: isRTL ? 'الحالة' : 'Status' },
            ]}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Layers}      label={isRTL ? 'إجمالي الوحدات' : 'Total Units'}   value={kpis.total}     color="#4A7AAB" />
        <KpiCard icon={Package}     label={isRTL ? 'متاح' : 'Available'}               value={kpis.available} color="#22C55E" />
        <KpiCard icon={Clock}       label={isRTL ? 'محجوز' : 'Reserved'}               value={kpis.reserved}  color="#F59E0B" />
        <KpiCard icon={CheckCircle} label={isRTL ? 'مباع' : 'Sold'}                    value={kpis.sold}      color="#EF4444" />
      </div>

      {/* SmartFilter */}
      <div className="mb-5">
        <SmartFilter
          fields={filterFields}
          filters={filters}
          onFiltersChange={setFilters}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={isRTL ? 'بحث بكود الوحدة، المشروع...' : 'Search by unit code, project...'}
          resultsCount={filtered.length}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>{isRTL ? 'كود الوحدة' : 'Unit Code'}</th>
                <th className={thCls}>{isRTL ? 'المشروع' : 'Project'}</th>
                <th className={thCls}>{isRTL ? 'النوع' : 'Type'}</th>
                <th className={thCls}>{isRTL ? 'المساحة' : 'Area'}</th>
                <th className={thCls}>{isRTL ? 'الدور' : 'Floor'}</th>
                <th className={thCls}>{isRTL ? 'غرف' : 'Beds'}</th>
                <th className={thCls}>{isRTL ? 'السعر' : 'Price'}</th>
                <th className={thCls}>{isRTL ? 'الحالة' : 'Status'}</th>
                <th className={thCls}>{isRTL ? 'الإطلالة' : 'View'}</th>
                <th className={thCls}>{isRTL ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
                    {isRTL ? 'لا توجد وحدات' : 'No units found'}
                  </td>
                </tr>
              ) : (
                paged.map(unit => {
                  const sCfg = UNIT_STATUS_CONFIG[unit.status] || UNIT_STATUS_CONFIG.available;
                  const viewCfg = VIEW_CONFIG[unit.view];
                  return (
                    <tr
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className={tdCls}>
                        <span className="font-semibold text-brand-500">{unit.unit_code}</span>
                      </td>
                      <td className={tdCls}>{isRTL ? unit.project_ar : unit.project_en}</td>
                      <td className={tdCls}>{isRTL ? unit.type_ar : unit.type_en}</td>
                      <td className={tdCls}>{unit.area} {isRTL ? 'م²' : 'm²'}</td>
                      <td className={tdCls}>{unit.floor == 0 ? (isRTL ? 'أرضي' : 'Ground') : unit.floor}</td>
                      <td className={tdCls}>{unit.bedrooms === 0 ? (isRTL ? 'استوديو' : 'Studio') : unit.bedrooms}</td>
                      <td className={tdCls}>
                        <span className="font-semibold">{fmtMoney(unit.price)}</span>
                        <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-1">{isRTL ? 'ج.م' : 'EGP'}</span>
                      </td>
                      <td className={tdCls}>
                        <span
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: sCfg.color, background: sCfg.bg }}
                        >
                          {isRTL ? sCfg.ar : sCfg.en}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-xs">{viewCfg ? (isRTL ? viewCfg.ar : viewCfg.en) : unit.view}</span>
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleEdit(unit, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-transparent border border-edge dark:border-edge-dark cursor-pointer hover:bg-brand-500/10 transition-colors"
                            title={isRTL ? 'تعديل' : 'Edit'}
                          >
                            <Pencil size={13} className="text-brand-500" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(unit, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-transparent border border-red-200 dark:border-red-500/20 cursor-pointer hover:bg-red-500/10 transition-colors"
                            title={isRTL ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-content-muted dark:text-content-muted-dark">
            <Home size={40} className="mb-2 opacity-30" />
            <p className="text-sm">{isRTL ? 'لا توجد وحدات' : 'No units found'}</p>
          </div>
        ) : (
          paged.map(unit => {
            const sCfg = UNIT_STATUS_CONFIG[unit.status] || UNIT_STATUS_CONFIG.available;
            const viewCfg = VIEW_CONFIG[unit.view];
            return (
              <div
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark p-4 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-brand-500">{unit.unit_code}</span>
                    <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
                      {isRTL ? unit.project_ar : unit.project_en}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ color: sCfg.color, background: sCfg.bg }}
                    >
                      {isRTL ? sCfg.ar : sCfg.en}
                    </span>
                    <button
                      onClick={(e) => handleEdit(unit, e)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-transparent border border-edge dark:border-edge-dark cursor-pointer hover:bg-brand-500/10 transition-colors"
                    >
                      <Pencil size={13} className="text-brand-500" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(unit, e)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-transparent border border-red-200 dark:border-red-500/20 cursor-pointer hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{isRTL ? 'النوع' : 'Type'}</p>
                    <p className="text-xs font-medium text-content dark:text-content-dark m-0 mt-0.5">{isRTL ? unit.type_ar : unit.type_en}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{isRTL ? 'المساحة' : 'Area'}</p>
                    <p className="text-xs font-medium text-content dark:text-content-dark m-0 mt-0.5">{unit.area} {isRTL ? 'م²' : 'm²'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{isRTL ? 'السعر' : 'Price'}</p>
                    <p className="text-xs font-bold text-content dark:text-content-dark m-0 mt-0.5">{fmtMoney(unit.price)}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        totalItems={filtered.length}
      />

      {/* Drawer */}
      {selectedUnit && (
        <UnitDrawer
          unit={selectedUnit}
          isRTL={isRTL}
          isDark={isDark}
          onClose={() => setSelectedUnit(null)}
          onEdit={(unit) => { setSelectedUnit(null); handleEdit(unit); }}
          onDelete={(unit) => { setSelectedUnit(null); handleDelete(unit); }}
        />
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <UnitFormModal
          isRTL={isRTL}
          isDark={isDark}
          formData={formData}
          setFormData={setFormData}
          isEditing={!!editingUnit}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingUnit(null); setFormData({ ...EMPTY_FORM }); }}
          projectOptions={projectOptions}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          isRTL={isRTL}
          isDark={isDark}
          unit={deleteConfirm}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Unit Form Modal ─────────────────────────────────────────
function UnitFormModal({ isRTL, isDark, formData, setFormData, isEditing, onSave, onClose, projectOptions }) {
  useEscClose(onClose);

  const update = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const labelCls = 'block text-xs font-semibold text-content dark:text-content-dark mb-1.5';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-card dark:bg-surface-card-dark shadow-2xl border border-edge dark:border-edge-dark">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-bold text-content dark:text-content-dark m-0">
            {isEditing
              ? (isRTL ? 'تعديل الوحدة' : 'Edit Unit')
              : (isRTL ? 'إضافة وحدة' : 'Add Unit')
            }
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-transparent cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-content-muted dark:text-content-muted-dark" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {/* Project */}
          <div>
            <label className={labelCls}>{isRTL ? 'المشروع' : 'Project'}</label>
            <Select
              value={formData.project_id}
              onChange={(e) => update('project_id', e.target.value)}
              className="w-full"
            >
              <option value="">{isRTL ? '-- اختر المشروع --' : '-- Select Project --'}</option>
              {projectOptions.map(p => (
                <option key={p.id} value={p.id}>{isRTL ? p.ar : p.en}</option>
              ))}
            </Select>
          </div>

          {/* Unit Number + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isRTL ? 'رقم/كود الوحدة' : 'Unit Number/Code'}</label>
              <Input
                value={formData.unit_number}
                onChange={(e) => update('unit_number', e.target.value)}
                placeholder={isRTL ? 'اتركه فارغ للتوليد التلقائي' : 'Leave empty for auto-generate'}
                className="w-full"
              />
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'نوع الوحدة' : 'Unit Type'}</label>
              <Select
                value={formData.type}
                onChange={(e) => update('type', e.target.value)}
                className="w-full"
              >
                {Object.entries(UNIT_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Area + Floor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isRTL ? 'المساحة (م²)' : 'Area (m\u00B2)'}</label>
              <Input
                type="number"
                value={formData.area}
                onChange={(e) => update('area', e.target.value)}
                placeholder="150"
                className="w-full"
              />
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'الدور' : 'Floor'}</label>
              <Input
                value={formData.floor}
                onChange={(e) => update('floor', e.target.value)}
                placeholder={isRTL ? '0 = أرضي' : '0 = Ground'}
                className="w-full"
              />
            </div>
          </div>

          {/* Rooms + Bathrooms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isRTL ? 'عدد الغرف' : 'Rooms'}</label>
              <Input
                type="number"
                value={formData.rooms}
                onChange={(e) => update('rooms', e.target.value)}
                placeholder="3"
                className="w-full"
              />
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'عدد الحمامات' : 'Bathrooms'}</label>
              <Input
                type="number"
                value={formData.bathrooms}
                onChange={(e) => update('bathrooms', e.target.value)}
                placeholder="2"
                className="w-full"
              />
            </div>
          </div>

          {/* Finishing + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isRTL ? 'التشطيب' : 'Finishing'}</label>
              <Select
                value={formData.finishing}
                onChange={(e) => update('finishing', e.target.value)}
                className="w-full"
              >
                {Object.entries(FINISHING_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className={labelCls}>{isRTL ? 'الحالة' : 'Status'}</label>
              <Select
                value={formData.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full"
              >
                {Object.entries(UNIT_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className={labelCls}>{isRTL ? 'السعر' : 'Price'}</label>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="3,500,000"
              className="w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
              rows={3}
              className="w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-card dark:bg-surface-card-dark border-t border-edge dark:border-edge-dark px-5 py-4 flex items-center justify-end gap-2 rounded-b-2xl">
          <Button variant="secondary" size="md" onClick={onClose}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="primary" size="md" onClick={onSave}>
            {isEditing
              ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
              : (isRTL ? 'إضافة الوحدة' : 'Add Unit')
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────
function DeleteConfirmModal({ isRTL, isDark, unit, onConfirm, onCancel }) {
  useEscClose(onCancel);

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      {/* Modal */}
      <div className="relative w-full max-w-[400px] rounded-2xl bg-surface-card dark:bg-surface-card-dark shadow-2xl border border-edge dark:border-edge-dark p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-base font-bold text-content dark:text-content-dark m-0 mb-2">
          {isRTL ? 'حذف الوحدة' : 'Delete Unit'}
        </h3>
        <p className="text-sm text-content-muted dark:text-content-muted-dark m-0 mb-1">
          {isRTL
            ? `هل أنت متأكد من حذف الوحدة "${unit.unit_code}"؟`
            : `Are you sure you want to delete unit "${unit.unit_code}"?`
          }
        </p>
        <p className="text-xs text-red-500 m-0 mb-5">
          {isRTL ? 'لا يمكن التراجع عن هذا الإجراء' : 'This action cannot be undone'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="md" onClick={onCancel}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm}>
            <Trash2 size={14} />
            {isRTL ? 'حذف' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Unit Drawer ──────────────────────────────────────────────
function UnitDrawer({ unit, isRTL, isDark, onClose, onEdit, onDelete }) {
  const u = unit;
  const sCfg = UNIT_STATUS_CONFIG[u.status] || UNIT_STATUS_CONFIG.available;
  const viewCfg = VIEW_CONFIG[u.view];
  const typeCfg = UNIT_TYPE_CONFIG[u.type];
  const finCfg = FINISHING_CONFIG[u.finishing];

  useEscClose(onClose);

  const DetailRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-edge/50 dark:border-edge-dark/50 last:border-0">
      {Icon && <Icon size={14} className="text-content-muted dark:text-content-muted-dark mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0">{label}</p>
        <p className="text-sm font-medium text-content dark:text-content-dark m-0 mt-0.5">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Spacer */}
      <div className="flex-1" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-[480px] h-full bg-surface-card dark:bg-surface-card-dark shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark px-5 py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-content dark:text-content-dark m-0">
              {u.unit_code}
            </h2>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
              {isRTL ? u.project_ar : u.project_en}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(u)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-transparent cursor-pointer hover:bg-brand-500/10 transition-colors"
              title={isRTL ? 'تعديل' : 'Edit'}
            >
              <Pencil size={15} className="text-brand-500" />
            </button>
            <button
              onClick={() => onDelete(u)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-500/20 bg-transparent cursor-pointer hover:bg-red-500/10 transition-colors"
              title={isRTL ? 'حذف' : 'Delete'}
            >
              <Trash2 size={15} className="text-red-500" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-transparent cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} className="text-content-muted dark:text-content-muted-dark" />
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="px-5 pt-4 flex gap-2 flex-wrap">
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: sCfg.color, background: sCfg.bg }}
          >
            {isRTL ? sCfg.ar : sCfg.en}
          </span>
          {typeCfg && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-content dark:text-content-dark">
              {isRTL ? typeCfg.ar : typeCfg.en}
            </span>
          )}
          {viewCfg && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-content dark:text-content-dark flex items-center gap-1">
              <Eye size={12} /> {isRTL ? viewCfg.ar : viewCfg.en}
            </span>
          )}
          {finCfg && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-content dark:text-content-dark">
              {isRTL ? finCfg.ar : finCfg.en}
            </span>
          )}
        </div>

        {/* Details */}
        <div className="px-5 py-4">
          <DetailRow icon={Building2}  label={isRTL ? 'المشروع' : 'Project'}   value={isRTL ? u.project_ar : u.project_en} />
          <DetailRow icon={Home}       label={isRTL ? 'النوع' : 'Type'}        value={isRTL ? u.type_ar : u.type_en} />
          <DetailRow icon={Maximize2}  label={isRTL ? 'المساحة' : 'Area'}      value={`${u.area} ${isRTL ? 'م²' : 'm²'}`} />
          <DetailRow icon={Layers}     label={isRTL ? 'الدور' : 'Floor'}       value={u.floor == 0 ? (isRTL ? 'أرضي' : 'Ground') : String(u.floor)} />
          <DetailRow icon={BedDouble}  label={isRTL ? 'غرف النوم' : 'Bedrooms'} value={u.bedrooms === 0 ? (isRTL ? 'استوديو' : 'Studio') : String(u.bedrooms)} />
          <DetailRow icon={ShieldCheck} label={isRTL ? 'الحمامات' : 'Bathrooms'} value={String(u.bathrooms)} />
          <DetailRow icon={Eye}        label={isRTL ? 'الإطلالة' : 'View'}     value={viewCfg ? (isRTL ? viewCfg.ar : viewCfg.en) : (u.view || '-')} />

          {u.notes && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-white/5">
              <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0 mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</p>
              <p className="text-sm text-content dark:text-content-dark m-0">{u.notes}</p>
            </div>
          )}

          {/* Price card */}
          <div className="mt-5 rounded-xl border border-edge dark:border-edge-dark p-4 text-center">
            <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0 mb-1">
              {isRTL ? 'السعر' : 'Price'}
            </p>
            <p className="text-2xl font-extrabold text-content dark:text-content-dark m-0">
              {fmtMoney(u.price)}
              <span className="text-sm font-normal text-content-muted dark:text-content-muted-dark ms-1">
                {isRTL ? 'ج.م' : 'EGP'}
              </span>
            </p>
            {u.area > 0 && (
              <p className="text-[11px] text-content-muted dark:text-content-muted-dark m-0 mt-1">
                {fmtMoney(Math.round(u.price / u.area))} / {isRTL ? 'م²' : 'm²'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
