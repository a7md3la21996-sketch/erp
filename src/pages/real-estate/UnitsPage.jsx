import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Home, Package, CheckCircle, Clock, X, Building2, Maximize2, BedDouble, Eye, Layers, ShieldCheck } from 'lucide-react';
import { KpiCard, SmartFilter, applySmartFilters, ExportButton } from '../../components/ui';
import { fmtMoney } from '../../utils/formatting';
import { thCls, tdCls } from '../../utils/tableStyles';
import { useEscClose } from '../../utils/hooks';

// ── Storage ──────────────────────────────────────────────────
const STORAGE_KEY = 'platform_units';

// ── Status Config ────────────────────────────────────────────
const UNIT_STATUS_CONFIG = {
  available:          { ar: 'متاح',       en: 'Available',          color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)' },
  reserved:           { ar: 'محجوز',      en: 'Reserved',           color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  sold:               { ar: 'مباع',       en: 'Sold',               color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)' },
  under_construction: { ar: 'تحت الإنشاء', en: 'Under Construction', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
};

const UNIT_TYPE_CONFIG = {
  apartment: { ar: 'شقة',       en: 'Apartment' },
  villa:     { ar: 'فيلا',      en: 'Villa' },
  townhouse: { ar: 'تاون هاوس', en: 'Townhouse' },
  duplex:    { ar: 'دوبلكس',    en: 'Duplex' },
  penthouse: { ar: 'بنتهاوس',   en: 'Penthouse' },
  studio:    { ar: 'استوديو',   en: 'Studio' },
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

// ── Mock Units ───────────────────────────────────────────────
const DEFAULT_UNITS = [
  { id: 'u1',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-101', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 150, floor: 1, bedrooms: 3, bathrooms: 2, price: 3500000, status: 'available',          view: 'garden' },
  { id: 'u2',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-204', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 120, floor: 2, bedrooms: 2, bathrooms: 1, price: 2800000, status: 'reserved',           view: 'street' },
  { id: 'u3',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'B-501', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 180, floor: 5, bedrooms: 3, bathrooms: 2, price: 4500000, status: 'sold',               view: 'landscape' },
  { id: 'u4',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'C-302', type_ar: 'دوبلكس',    type_en: 'Duplex',    type: 'duplex',    area: 250, floor: 3, bedrooms: 4, bathrooms: 3, price: 5500000, status: 'sold',               view: 'garden' },
  { id: 'u5',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'A-712', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 160, floor: 7, bedrooms: 3, bathrooms: 2, price: 3800000, status: 'sold',               view: 'open' },
  { id: 'u6',  project_id: 'p1',  project_ar: 'سيليا',          project_en: 'Celia',              unit_code: 'PH-01', type_ar: 'بنتهاوس',   type_en: 'Penthouse', type: 'penthouse', area: 320, floor: 10, bedrooms: 4, bathrooms: 3, price: 8000000, status: 'available',          view: 'open' },
  { id: 'u7',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'A-410', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 130, floor: 4, bedrooms: 2, bathrooms: 1, price: 1800000, status: 'sold',               view: 'pool' },
  { id: 'u8',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'B-108', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 140, floor: 1, bedrooms: 2, bathrooms: 2, price: 2100000, status: 'sold',               view: 'garden' },
  { id: 'u9',  project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'V-12',  type_ar: 'فيلا',      type_en: 'Villa',     type: 'villa',     area: 350, floor: 0, bedrooms: 5, bathrooms: 4, price: 7200000, status: 'reserved',           view: 'landscape' },
  { id: 'u10', project_id: 'p2',  project_ar: 'ريفان',          project_en: 'Rivan',              unit_code: 'C-305', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 155, floor: 3, bedrooms: 3, bathrooms: 2, price: 2400000, status: 'available',          view: 'pool' },
  { id: 'u11', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'TH-03', type_ar: 'تاون هاوس', type_en: 'Townhouse', type: 'townhouse', area: 220, floor: 0, bedrooms: 4, bathrooms: 3, price: 4100000, status: 'sold',               view: 'corner' },
  { id: 'u12', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'TH-08', type_ar: 'تاون هاوس', type_en: 'Townhouse', type: 'townhouse', area: 200, floor: 0, bedrooms: 3, bathrooms: 2, price: 3200000, status: 'reserved',           view: 'garden' },
  { id: 'u13', project_id: 'p3',  project_ar: 'تاون جيت',       project_en: 'Town Gate',          unit_code: 'A-201', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 110, floor: 2, bedrooms: 2, bathrooms: 1, price: 2200000, status: 'available',          view: 'street' },
  { id: 'u14', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'D-105', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 165, floor: 1, bedrooms: 3, bathrooms: 2, price: 3200000, status: 'available',          view: 'landscape' },
  { id: 'u15', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'V-05',  type_ar: 'فيلا',      type_en: 'Villa',     type: 'villa',     area: 400, floor: 0, bedrooms: 5, bathrooms: 4, price: 9000000, status: 'under_construction', view: 'lake' },
  { id: 'u16', project_id: 'p5',  project_ar: 'مستقبل سيتي',    project_en: 'Mostakbal City',     unit_code: 'S-301', type_ar: 'استوديو',   type_en: 'Studio',    type: 'studio',    area: 55,  floor: 3, bedrooms: 0, bathrooms: 1, price: 2000000, status: 'available',          view: 'open' },
  { id: 'u17', project_id: 'p7',  project_ar: 'هايد بارك',      project_en: 'Hyde Park',          unit_code: 'HP-210', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 190, floor: 2, bedrooms: 3, bathrooms: 2, price: 5500000, status: 'available',          view: 'garden' },
  { id: 'u18', project_id: 'p7',  project_ar: 'هايد بارك',      project_en: 'Hyde Park',          unit_code: 'HP-V03', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 500, floor: 0, bedrooms: 6, bathrooms: 5, price: 18000000, status: 'reserved',          view: 'lake' },
  { id: 'u19', project_id: 'p9',  project_ar: 'بالم هيلز',      project_en: 'Palm Hills NC',      unit_code: 'PH-C12', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 100, floor: 1, bedrooms: 2, bathrooms: 1, price: 6000000, status: 'available',          view: 'pool' },
  { id: 'u20', project_id: 'p9',  project_ar: 'بالم هيلز',      project_en: 'Palm Hills NC',      unit_code: 'PH-V01', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 300, floor: 0, bedrooms: 4, bathrooms: 3, price: 25000000, status: 'sold',              view: 'landscape' },
  { id: 'u21', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'D-105', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 90,  floor: 1, bedrooms: 2, bathrooms: 1, price: 1350000, status: 'sold',               view: 'street' },
  { id: 'u22', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'E-203', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 100, floor: 2, bedrooms: 2, bathrooms: 1, price: 1650000, status: 'reserved',           view: 'garden' },
  { id: 'u23', project_id: 'p10', project_ar: 'بلو تري',        project_en: 'Blue Tree',          unit_code: 'F-101', type_ar: 'شقة',       type_en: 'Apartment', type: 'apartment', area: 85,  floor: 1, bedrooms: 2, bathrooms: 1, price: 950000,  status: 'available',          view: 'street' },
  { id: 'u24', project_id: 'p4',  project_ar: 'ال بوسكو',       project_en: 'IL Bosco',           unit_code: 'IB-401', type_ar: 'دوبلكس',   type_en: 'Duplex',    type: 'duplex',    area: 280, floor: 4, bedrooms: 4, bathrooms: 3, price: 8500000, status: 'sold',               view: 'landscape' },
  { id: 'u25', project_id: 'p4',  project_ar: 'ال بوسكو',       project_en: 'IL Bosco',           unit_code: 'IB-PH2', type_ar: 'بنتهاوس',  type_en: 'Penthouse', type: 'penthouse', area: 350, floor: 12, bedrooms: 5, bathrooms: 4, price: 12000000, status: 'sold',              view: 'open' },
  { id: 'u26', project_id: 'p8',  project_ar: 'سوديك ايست',     project_en: 'Sodic East',         unit_code: 'SE-101', type_ar: 'شقة',      type_en: 'Apartment', type: 'apartment', area: 170, floor: 1, bedrooms: 3, bathrooms: 2, price: 5500000, status: 'under_construction', view: 'garden' },
  { id: 'u27', project_id: 'p8',  project_ar: 'سوديك ايست',     project_en: 'Sodic East',         unit_code: 'SE-V01', type_ar: 'فيلا',     type_en: 'Villa',     type: 'villa',     area: 450, floor: 0, bedrooms: 5, bathrooms: 4, price: 20000000, status: 'under_construction', view: 'corner' },
  { id: 'u28', project_id: 'p6',  project_ar: 'ماونتن فيو',     project_en: 'Mountain View iCity', unit_code: 'MV-305', type_ar: 'شقة',     type_en: 'Apartment', type: 'apartment', area: 175, floor: 3, bedrooms: 3, bathrooms: 2, price: 6500000, status: 'sold',               view: 'landscape' },
];

function loadUnits() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_UNITS));
  return [...DEFAULT_UNITS];
}

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
  const PAGE_SIZE = 25;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  }, [units]);

  // SmartFilter field definitions
  const filterFields = useMemo(() => [
    {
      id: 'project_en',
      label: 'المشروع',
      labelEn: 'Project',
      type: 'select',
      options: [...new Set(units.map(u => u.project_en))].map(p => {
        const u = units.find(x => x.project_en === p);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [filters, search]);

  // KPI values
  const kpis = useMemo(() => ({
    total: units.length,
    available: units.filter(u => u.status === 'available').length,
    reserved: units.filter(u => u.status === 'reserved').length,
    sold: units.filter(u => u.status === 'sold').length,
  }), [units]);

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Layers}      label={isRTL ? 'إجمالي الوحدات' : 'Total Units'}   value={kpis.total}     color="#4A7AAB" />
        <KpiCard icon={Package}     label={isRTL ? 'متاح' : 'Available'}               value={kpis.available} color="#2B4C6F" />
        <KpiCard icon={Clock}       label={isRTL ? 'محجوز' : 'Reserved'}               value={kpis.reserved}  color="#F97316" />
        <KpiCard icon={CheckCircle} label={isRTL ? 'مباع' : 'Sold'}                    value={kpis.sold}      color="#1B3347" />
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-content-muted dark:text-content-muted-dark text-sm">
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
                      <td className={tdCls}>{unit.floor === 0 ? (isRTL ? 'أرضي' : 'Ground') : unit.floor}</td>
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
                  <span
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ color: sCfg.color, background: sCfg.bg }}
                  >
                    {isRTL ? sCfg.ar : sCfg.en}
                  </span>
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
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 py-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${page === 1 ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
            {isRTL ? '← السابق' : '← Prev'}
          </button>
          <span className="text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? `${safePage} من ${totalPages}` : `${safePage} of ${totalPages}`}
          </span>
          <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}
            className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${safePage === totalPages ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
            {isRTL ? 'التالي →' : 'Next →'}
          </button>
        </div>
      )}

      {/* Drawer */}
      {selectedUnit && (
        <UnitDrawer
          unit={selectedUnit}
          isRTL={isRTL}
          isDark={isDark}
          onClose={() => setSelectedUnit(null)}
        />
      )}
    </div>
  );
}

// ── Unit Drawer ──────────────────────────────────────────────
function UnitDrawer({ unit, isRTL, isDark, onClose }) {
  const u = unit;
  const sCfg = UNIT_STATUS_CONFIG[u.status] || UNIT_STATUS_CONFIG.available;
  const viewCfg = VIEW_CONFIG[u.view];
  const typeCfg = UNIT_TYPE_CONFIG[u.type];

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
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-transparent cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-content-muted dark:text-content-muted-dark" />
          </button>
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
        </div>

        {/* Details */}
        <div className="px-5 py-4">
          <DetailRow icon={Building2}  label={isRTL ? 'المشروع' : 'Project'}   value={isRTL ? u.project_ar : u.project_en} />
          <DetailRow icon={Home}       label={isRTL ? 'النوع' : 'Type'}        value={isRTL ? u.type_ar : u.type_en} />
          <DetailRow icon={Maximize2}  label={isRTL ? 'المساحة' : 'Area'}      value={`${u.area} ${isRTL ? 'م²' : 'm²'}`} />
          <DetailRow icon={Layers}     label={isRTL ? 'الدور' : 'Floor'}       value={u.floor === 0 ? (isRTL ? 'أرضي' : 'Ground') : String(u.floor)} />
          <DetailRow icon={BedDouble}  label={isRTL ? 'غرف النوم' : 'Bedrooms'} value={u.bedrooms === 0 ? (isRTL ? 'استوديو' : 'Studio') : String(u.bedrooms)} />
          <DetailRow icon={ShieldCheck} label={isRTL ? 'الحمامات' : 'Bathrooms'} value={String(u.bathrooms)} />
          <DetailRow icon={Eye}        label={isRTL ? 'الإطلالة' : 'View'}     value={viewCfg ? (isRTL ? viewCfg.ar : viewCfg.en) : (u.view || '-')} />

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
