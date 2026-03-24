import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Home, TrendingUp, Package, X, ChevronRight, ChevronLeft, Users, Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { KpiCard, ExportButton, Pagination, Button, Input, Select } from '../../components/ui';
import { fmtMoney } from '../../utils/formatting';
import { useEscClose } from '../../utils/hooks';

// ── Storage ──────────────────────────────────────────────────
const STORAGE_KEY = 'platform_projects';

const saveProjects = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

// ── Status / Type configs ────────────────────────────────────
const PROJECT_STATUS_CONFIG = {
  upcoming:   { ar: 'قريبا',     en: 'Upcoming',   color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  selling:    { ar: 'متاح للبيع', en: 'Selling',    color: '#4A7AAB', bg: 'rgba(74,122,171,0.15)' },
  sold_out:   { ar: 'نفد',       en: 'Sold Out',   color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)' },
  completed:  { ar: 'مكتمل',     en: 'Completed',  color: '#1B3347', bg: 'rgba(27,51,71,0.18)' },
};

const PROJECT_TYPE_CONFIG = {
  residential: { ar: 'سكني',    en: 'Residential', color: '#4A7AAB' },
  commercial:  { ar: 'تجاري',   en: 'Commercial',  color: '#2B4C6F' },
  mixed:       { ar: 'مختلط',   en: 'Mixed Use',   color: '#6B8DB5' },
  resort:      { ar: 'منتجع',   en: 'Resort',      color: '#1B3347' },
};

// ── Empty form state ─────────────────────────────────────────
const EMPTY_FORM = {
  name_ar: '', name_en: '',
  developer_ar: '', developer_en: '',
  location_ar: '', location_en: '',
  type: 'residential',
  status: 'upcoming',
  units_total: '',
  units_sold: '',
  units_available: '',
  price_from: '',
  price_to: '',
};

// ── Mock Data ────────────────────────────────────────────────
const DEFAULT_PROJECTS = [
  { id: 'p1', name_ar: 'سيليا العاصمة الجديدة', name_en: 'Celia New Capital', developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', location_ar: 'العاصمة الإدارية', location_en: 'New Capital', type: 'residential', units_total: 500, units_sold: 320, units_available: 180, price_from: 2500000, price_to: 8000000, status: 'selling', image: null, created_at: '2025-06-01' },
  { id: 'p2', name_ar: 'ريفان الشيخ زايد', name_en: 'Rivan Sheikh Zayed', developer_ar: 'ريبورتاج', developer_en: 'Reportage', location_ar: 'الشيخ زايد', location_en: 'Sheikh Zayed', type: 'residential', units_total: 350, units_sold: 210, units_available: 140, price_from: 1800000, price_to: 7200000, status: 'selling', image: null, created_at: '2025-04-15' },
  { id: 'p3', name_ar: 'تاون جيت 6 اكتوبر', name_en: 'Town Gate October', developer_ar: 'اورا', developer_en: 'ORA', location_ar: '6 أكتوبر', location_en: '6th October', type: 'mixed', units_total: 420, units_sold: 380, units_available: 40, price_from: 2200000, price_to: 6500000, status: 'selling', image: null, created_at: '2025-03-10' },
  { id: 'p4', name_ar: 'ال بوسكو العاصمة', name_en: 'IL Bosco New Capital', developer_ar: 'مصر ايطاليا', developer_en: 'Misr Italia', location_ar: 'العاصمة الإدارية', location_en: 'New Capital', type: 'residential', units_total: 600, units_sold: 600, units_available: 0, price_from: 3000000, price_to: 12000000, status: 'sold_out', image: null, created_at: '2024-11-01' },
  { id: 'p5', name_ar: 'مستقبل سيتي', name_en: 'Mostakbal City', developer_ar: 'الأهلي صبور', developer_en: 'Al Ahly Sabbour', location_ar: 'مدينة المستقبل', location_en: 'Mostakbal City', type: 'residential', units_total: 800, units_sold: 450, units_available: 350, price_from: 2000000, price_to: 9000000, status: 'selling', image: null, created_at: '2025-01-20' },
  { id: 'p6', name_ar: 'ماونتن فيو اي سيتي', name_en: 'Mountain View iCity', developer_ar: 'ماونتن فيو', developer_en: 'Mountain View', location_ar: 'التجمع الخامس', location_en: 'New Cairo', type: 'mixed', units_total: 450, units_sold: 450, units_available: 0, price_from: 3500000, price_to: 15000000, status: 'completed', image: null, created_at: '2023-08-01' },
  { id: 'p7', name_ar: 'هايد بارك التجمع', name_en: 'Hyde Park New Cairo', developer_ar: 'هايد بارك', developer_en: 'Hyde Park', location_ar: 'التجمع الخامس', location_en: 'New Cairo', type: 'residential', units_total: 550, units_sold: 280, units_available: 270, price_from: 4000000, price_to: 18000000, status: 'selling', image: null, created_at: '2025-02-10' },
  { id: 'p8', name_ar: 'سوديك ايست', name_en: 'Sodic East', developer_ar: 'سوديك', developer_en: 'Sodic', location_ar: 'القاهرة الجديدة', location_en: 'New Cairo', type: 'residential', units_total: 300, units_sold: 45, units_available: 255, price_from: 5000000, price_to: 20000000, status: 'upcoming', image: null, created_at: '2025-09-01' },
  { id: 'p9', name_ar: 'بالم هيلز الساحل', name_en: 'Palm Hills North Coast', developer_ar: 'بالم هيلز', developer_en: 'Palm Hills', location_ar: 'الساحل الشمالي', location_en: 'North Coast', type: 'resort', units_total: 200, units_sold: 170, units_available: 30, price_from: 6000000, price_to: 25000000, status: 'selling', image: null, created_at: '2024-12-01' },
  { id: 'p10', name_ar: 'بلو تري المرج', name_en: 'Blue Tree El Marg', developer_ar: 'سيتي إيدج', developer_en: 'City Edge', location_ar: 'المرج', location_en: 'El Marg', type: 'residential', units_total: 380, units_sold: 95, units_available: 285, price_from: 900000, price_to: 2500000, status: 'selling', image: null, created_at: '2025-07-15' },
];

function loadProjects() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
  return [...DEFAULT_PROJECTS];
}

// ── Main Component ───────────────────────────────────────────
export default function ProjectsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [projects, setProjects] = useState(() => loadProjects());
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // CRUD modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null); // null = add mode, object = edit mode
  const [deleteConfirm, setDeleteConfirm] = useState(null); // project to delete

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  const filtered = useMemo(() => {
    let result = [...projects];
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter(p => p.type === typeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        (p.name_ar || '').includes(s) || (p.name_en || '').toLowerCase().includes(s) ||
        (p.developer_ar || '').includes(s) || (p.developer_en || '').toLowerCase().includes(s) ||
        (p.location_ar || '').includes(s) || (p.location_en || '').toLowerCase().includes(s)
      );
    }
    return result;
  }, [projects, statusFilter, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, search, pageSize]);

  // KPI values
  const kpis = useMemo(() => {
    const all = projects;
    return {
      total: all.length,
      selling: all.filter(p => p.status === 'selling').length,
      totalUnits: all.reduce((s, p) => s + (p.units_total || 0), 0),
      availableUnits: all.reduce((s, p) => s + (p.units_available || 0), 0),
    };
  }, [projects]);

  const CloseIcon = X;
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  // ── CRUD handlers ────────────────────────────────────────────
  const handleOpenAdd = useCallback(() => {
    setEditingProject(null);
    setShowFormModal(true);
  }, []);

  const handleOpenEdit = useCallback((project, e) => {
    e.stopPropagation();
    setEditingProject(project);
    setShowFormModal(true);
  }, []);

  const handleSaveProject = useCallback((formData) => {
    if (editingProject) {
      // Edit mode
      const updated = projects.map(p =>
        p.id === editingProject.id ? { ...p, ...formData } : p
      );
      setProjects(updated);
    } else {
      // Add mode
      const newProject = {
        ...formData,
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        image: null,
        created_at: new Date().toISOString().split('T')[0],
      };
      setProjects(prev => [newProject, ...prev]);
    }
    setShowFormModal(false);
    setEditingProject(null);
  }, [editingProject, projects]);

  const handleDeleteRequest = useCallback((project, e) => {
    e.stopPropagation();
    setDeleteConfirm(project);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirm) return;
    const updated = projects.filter(p => p.id !== deleteConfirm.id);
    setProjects(updated);
    setDeleteConfirm(null);
  }, [deleteConfirm, projects]);

  // ── Tab style ──────────────────────────────────────────────
  const tabCls = "flex gap-1 mb-5 bg-surface-card dark:bg-surface-card-dark rounded-xl p-1 border border-edge dark:border-edge-dark w-full md:w-fit overflow-x-auto";
  const tabBtnCls = (active) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
      active
        ? 'bg-brand-500 text-white shadow-sm'
        : 'text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-white/5'
    }`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/10">
            <Building2 size={22} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content dark:text-content-dark m-0">
              {isRTL ? 'المشاريع العقارية' : 'Real Estate Projects'}
            </h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
              {isRTL ? 'دليل المشاريع والوحدات' : 'Projects & units directory'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium cursor-pointer border-none hover:bg-brand-600 transition-colors shadow-sm"
          >
            <Plus size={16} />
            {isRTL ? 'إضافة مشروع' : 'Add Project'}
          </button>
          <ExportButton
            data={filtered}
            filename="projects"
            title={isRTL ? 'المشاريع العقارية' : 'Real Estate Projects'}
            columns={[
              { key: isRTL ? 'name_ar' : 'name_en', label: isRTL ? 'المشروع' : 'Project' },
              { key: isRTL ? 'developer_ar' : 'developer_en', label: isRTL ? 'المطور' : 'Developer' },
              { key: isRTL ? 'location_ar' : 'location_en', label: isRTL ? 'الموقع' : 'Location' },
              { key: 'units_total', label: isRTL ? 'إجمالي الوحدات' : 'Total Units' },
              { key: 'units_available', label: isRTL ? 'متاح' : 'Available' },
              { key: 'status', label: isRTL ? 'الحالة' : 'Status' },
            ]}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Building2} label={isRTL ? 'إجمالي المشاريع' : 'Total Projects'} value={kpis.total} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={isRTL ? 'متاح للبيع' : 'Selling'} value={kpis.selling} color="#2B4C6F" />
        <KpiCard icon={Layers} label={isRTL ? 'إجمالي الوحدات' : 'Total Units'} value={kpis.totalUnits.toLocaleString()} color="#1B3347" />
        <KpiCard icon={Package} label={isRTL ? 'وحدات متاحة' : 'Available Units'} value={kpis.availableUnits.toLocaleString()} color="#6B8DB5" />
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={isRTL ? 'بحث بالاسم، المطور، الموقع...' : 'Search by name, developer, location...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-sm placeholder:text-content-muted dark:placeholder:text-content-muted-dark focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Filters: Status tabs */}
      <div className={tabCls}>
        <button className={tabBtnCls(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>
          {isRTL ? 'الكل' : 'All'}
        </button>
        {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key} className={tabBtnCls(statusFilter === key)} onClick={() => setStatusFilter(key)}>
            {isRTL ? cfg.ar : cfg.en}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className={tabCls}>
        <button className={tabBtnCls(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>
          {isRTL ? 'كل الأنواع' : 'All Types'}
        </button>
        {Object.entries(PROJECT_TYPE_CONFIG).map(([key, cfg]) => (
          <button key={key} className={tabBtnCls(typeFilter === key)} onClick={() => setTypeFilter(key)}>
            {isRTL ? cfg.ar : cfg.en}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-content-muted dark:text-content-muted-dark mb-4">
        {filtered.length} {isRTL ? 'مشروع' : 'projects'}
      </p>

      {/* Project Cards Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-content-muted dark:text-content-muted-dark">
          <Building2 size={48} className="mb-3 opacity-30" />
          <p className="text-sm">{isRTL ? 'لا توجد مشاريع' : 'No projects found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paged.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              isRTL={isRTL}
              isDark={isDark}
              onClick={() => setSelectedProject(project)}
              onEdit={(e) => handleOpenEdit(project, e)}
              onDelete={(e) => handleDeleteRequest(project, e)}
            />
          ))}
        </div>
      )}

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
      {selectedProject && (
        <ProjectDrawer
          project={selectedProject}
          isRTL={isRTL}
          isDark={isDark}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {/* Add / Edit Modal */}
      {showFormModal && (
        <ProjectFormModal
          isRTL={isRTL}
          project={editingProject}
          onSave={handleSaveProject}
          onClose={() => { setShowFormModal(false); setEditingProject(null); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          isRTL={isRTL}
          project={deleteConfirm}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Project Form Modal (Add / Edit) ──────────────────────────
function ProjectFormModal({ isRTL, project, onSave, onClose }) {
  const isEdit = !!project;
  const [form, setForm] = useState(() => {
    if (project) {
      return {
        name_ar: project.name_ar || '',
        name_en: project.name_en || '',
        developer_ar: project.developer_ar || '',
        developer_en: project.developer_en || '',
        location_ar: project.location_ar || '',
        location_en: project.location_en || '',
        type: project.type || 'residential',
        status: project.status || 'upcoming',
        units_total: project.units_total?.toString() || '',
        units_sold: project.units_sold?.toString() || '',
        units_available: project.units_available?.toString() || '',
        price_from: project.price_from?.toString() || '',
        price_to: project.price_to?.toString() || '',
      };
    }
    return { ...EMPTY_FORM };
  });

  useEscClose(onClose);

  const update = (key, val) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      // Auto-calculate units_available when units_total or units_sold change
      if (key === 'units_total' || key === 'units_sold') {
        const total = parseInt(key === 'units_total' ? val : next.units_total) || 0;
        const sold = parseInt(key === 'units_sold' ? val : next.units_sold) || 0;
        next.units_available = String(Math.max(0, total - sold));
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name_ar.trim() && !form.name_en.trim()) return;
    onSave({
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim(),
      developer_ar: form.developer_ar.trim(),
      developer_en: form.developer_en.trim(),
      location_ar: form.location_ar.trim(),
      location_en: form.location_en.trim(),
      type: form.type,
      status: form.status,
      units_total: parseInt(form.units_total) || 0,
      units_sold: parseInt(form.units_sold) || 0,
      units_available: parseInt(form.units_available) || 0,
      price_from: parseInt(form.price_from) || 0,
      price_to: parseInt(form.price_to) || 0,
    });
  };

  const labelCls = "block text-[11px] font-medium text-content-muted dark:text-content-muted-dark mb-1";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-bold text-content dark:text-content-dark m-0">
            {isEdit
              ? (isRTL ? 'تعديل المشروع' : 'Edit Project')
              : (isRTL ? 'إضافة مشروع' : 'Add Project')
            }
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-edge dark:border-edge-dark bg-transparent cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-content-muted dark:text-content-muted-dark" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Name AR */}
            <div>
              <label className={labelCls}>{isRTL ? 'اسم المشروع (عربي)' : 'Project Name (AR)'}</label>
              <Input
                value={form.name_ar}
                onChange={e => update('name_ar', e.target.value)}
                placeholder={isRTL ? 'اسم المشروع بالعربي' : 'Arabic project name'}
              />
            </div>
            {/* Project Name EN */}
            <div>
              <label className={labelCls}>{isRTL ? 'اسم المشروع (إنجليزي)' : 'Project Name (EN)'}</label>
              <Input
                value={form.name_en}
                onChange={e => update('name_en', e.target.value)}
                placeholder={isRTL ? 'اسم المشروع بالإنجليزي' : 'English project name'}
              />
            </div>

            {/* Developer AR */}
            <div>
              <label className={labelCls}>{isRTL ? 'المطور (عربي)' : 'Developer (AR)'}</label>
              <Input
                value={form.developer_ar}
                onChange={e => update('developer_ar', e.target.value)}
                placeholder={isRTL ? 'اسم المطور بالعربي' : 'Arabic developer name'}
              />
            </div>
            {/* Developer EN */}
            <div>
              <label className={labelCls}>{isRTL ? 'المطور (إنجليزي)' : 'Developer (EN)'}</label>
              <Input
                value={form.developer_en}
                onChange={e => update('developer_en', e.target.value)}
                placeholder={isRTL ? 'اسم المطور بالإنجليزي' : 'English developer name'}
              />
            </div>

            {/* Location AR */}
            <div>
              <label className={labelCls}>{isRTL ? 'الموقع (عربي)' : 'Location (AR)'}</label>
              <Input
                value={form.location_ar}
                onChange={e => update('location_ar', e.target.value)}
                placeholder={isRTL ? 'الموقع بالعربي' : 'Arabic location'}
              />
            </div>
            {/* Location EN */}
            <div>
              <label className={labelCls}>{isRTL ? 'الموقع (إنجليزي)' : 'Location (EN)'}</label>
              <Input
                value={form.location_en}
                onChange={e => update('location_en', e.target.value)}
                placeholder={isRTL ? 'الموقع بالإنجليزي' : 'English location'}
              />
            </div>

            {/* Type */}
            <div>
              <label className={labelCls}>{isRTL ? 'نوع المشروع' : 'Project Type'}</label>
              <Select value={form.type} onChange={e => update('type', e.target.value)}>
                {Object.entries(PROJECT_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{isRTL ? cfg.ar : cfg.en}</option>
                ))}
              </Select>
            </div>
            {/* Status */}
            <div>
              <label className={labelCls}>{isRTL ? 'الحالة' : 'Status'}</label>
              <Select value={form.status} onChange={e => update('status', e.target.value)}>
                {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{isRTL ? cfg.ar : cfg.en}</option>
                ))}
              </Select>
            </div>

            {/* Units Total */}
            <div>
              <label className={labelCls}>{isRTL ? 'إجمالي الوحدات' : 'Total Units'}</label>
              <Input
                type="number"
                min="0"
                value={form.units_total}
                onChange={e => update('units_total', e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Units Sold */}
            <div>
              <label className={labelCls}>{isRTL ? 'الوحدات المباعة' : 'Units Sold'}</label>
              <Input
                type="number"
                min="0"
                value={form.units_sold}
                onChange={e => update('units_sold', e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Units Available (auto-calculated, read-only) */}
            <div>
              <label className={labelCls}>{isRTL ? 'الوحدات المتاحة' : 'Units Available'} <span className="text-content-muted dark:text-content-muted-dark">({isRTL ? 'تلقائي' : 'auto'})</span></label>
              <Input
                type="number"
                value={form.units_available}
                readOnly
                className="opacity-60"
              />
            </div>

            {/* Price From */}
            <div>
              <label className={labelCls}>{isRTL ? 'السعر من' : 'Price From'}</label>
              <Input
                type="number"
                min="0"
                value={form.price_from}
                onChange={e => update('price_from', e.target.value)}
                placeholder="0"
              />
            </div>
            {/* Price To */}
            <div>
              <label className={labelCls}>{isRTL ? 'السعر إلى' : 'Price To'}</label>
              <Input
                type="number"
                min="0"
                value={form.price_to}
                onChange={e => update('price_to', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-edge dark:border-edge-dark">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-sm"
            >
              {isEdit
                ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
                : (isRTL ? 'إضافة المشروع' : 'Add Project')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────
function DeleteConfirmModal({ isRTL, project, onConfirm, onClose }) {
  useEscClose(onClose);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-[400px] bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-content dark:text-content-dark m-0">
              {isRTL ? 'حذف المشروع' : 'Delete Project'}
            </h3>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
              {isRTL ? 'هل أنت متأكد من حذف هذا المشروع؟' : 'Are you sure you want to delete this project?'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-edge dark:border-edge-dark p-3 mb-5 bg-gray-50 dark:bg-white/5">
          <p className="text-sm font-semibold text-content dark:text-content-dark m-0">
            {isRTL ? project.name_ar : project.name_en}
          </p>
          <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
            {isRTL ? project.developer_ar : project.developer_en} — {isRTL ? project.location_ar : project.location_en}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer border border-edge dark:border-edge-dark bg-transparent text-content dark:text-content-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
          >
            {isRTL ? 'حذف' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ─────────────────────────────────────────────
function ProjectCard({ project, isRTL, isDark, onClick, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const p = project;
  const statusCfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.selling;
  const typeCfg = PROJECT_TYPE_CONFIG[p.type] || PROJECT_TYPE_CONFIG.residential;
  const soldPercent = p.units_total > 0 ? Math.round((p.units_sold / p.units_total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="rounded-xl border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 8px 24px rgba(74,122,171,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
        borderColor: hov ? 'rgba(74,122,171,0.4)' : undefined,
      }}
    >
      {/* Image placeholder / gradient */}
      <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${statusCfg.color}30, ${typeCfg.color}20)` }}>
        <div className="absolute top-3 start-3 flex gap-2">
          {/* Status badge */}
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{ color: statusCfg.color, background: statusCfg.bg, backdropFilter: 'blur(8px)' }}
          >
            {isRTL ? statusCfg.ar : statusCfg.en}
          </span>
          {/* Type badge */}
          <span
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
            style={{ color: typeCfg.color, background: `${typeCfg.color}15` }}
          >
            {isRTL ? typeCfg.ar : typeCfg.en}
          </span>
        </div>
        {/* Edit / Delete buttons */}
        <div className="absolute top-3 end-3 flex gap-1.5" style={{ opacity: hov ? 1 : 0, transition: 'opacity 0.2s' }}>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/90 dark:bg-black/50 border-none cursor-pointer hover:bg-white dark:hover:bg-black/70 transition-colors shadow-sm"
            title={isRTL ? 'تعديل' : 'Edit'}
          >
            <Pencil size={13} className="text-brand-500" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/90 dark:bg-black/50 border-none cursor-pointer hover:bg-white dark:hover:bg-black/70 transition-colors shadow-sm"
            title={isRTL ? 'حذف' : 'Delete'}
          >
            <Trash2 size={13} className="text-red-500" />
          </button>
        </div>
        <div className="absolute bottom-3 start-3">
          <Building2 size={32} style={{ color: `${statusCfg.color}60` }} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-content dark:text-content-dark m-0 mb-1 truncate">
          {isRTL ? p.name_ar : p.name_en}
        </h3>
        <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mb-0.5 flex items-center gap-1">
          <Building2 size={12} /> {isRTL ? p.developer_ar : p.developer_en}
        </p>
        <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mb-3 flex items-center gap-1">
          <MapPin size={12} /> {isRTL ? p.location_ar : p.location_en}
        </p>

        {/* Units progress */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-content-muted dark:text-content-muted-dark mb-1">
            <span>{isRTL ? 'مباع' : 'Sold'}: {p.units_sold}</span>
            <span>{soldPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${soldPercent}%`, background: statusCfg.color }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-content-muted dark:text-content-muted-dark mt-1">
            <span>{isRTL ? 'إجمالي' : 'Total'}: {p.units_total}</span>
            <span>{isRTL ? 'متاح' : 'Available'}: {p.units_available}</span>
          </div>
        </div>

        {/* Price range */}
        <div className="flex items-center justify-between pt-3 border-t border-edge dark:border-edge-dark">
          <span className="text-[11px] text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'من' : 'From'} {fmtMoney(p.price_from)} - {fmtMoney(p.price_to)} {isRTL ? 'ج.م' : 'EGP'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Project Drawer ───────────────────────────────────────────
function ProjectDrawer({ project, isRTL, isDark, onClose }) {
  const p = project;
  const statusCfg = PROJECT_STATUS_CONFIG[p.status] || PROJECT_STATUS_CONFIG.selling;
  const typeCfg = PROJECT_TYPE_CONFIG[p.type] || PROJECT_TYPE_CONFIG.residential;
  const soldPercent = p.units_total > 0 ? Math.round((p.units_sold / p.units_total) * 100) : 0;
  const reservedEstimate = Math.round(p.units_sold * 0.1);

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
      {/* Spacer pushes panel to the correct side */}
      <div className="flex-1" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-[480px] h-full bg-surface-card dark:bg-surface-card-dark shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-card dark:bg-surface-card-dark border-b border-edge dark:border-edge-dark px-5 py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-content dark:text-content-dark m-0 truncate">
              {isRTL ? p.name_ar : p.name_en}
            </h2>
            <p className="text-xs text-content-muted dark:text-content-muted-dark m-0 mt-0.5">
              {isRTL ? p.developer_ar : p.developer_en}
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
        <div className="px-5 pt-4 flex gap-2">
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ color: statusCfg.color, background: statusCfg.bg }}
          >
            {isRTL ? statusCfg.ar : statusCfg.en}
          </span>
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ color: typeCfg.color, background: `${typeCfg.color}15` }}
          >
            {isRTL ? typeCfg.ar : typeCfg.en}
          </span>
        </div>

        {/* Details */}
        <div className="px-5 py-4">
          <DetailRow icon={MapPin} label={isRTL ? 'الموقع' : 'Location'} value={isRTL ? p.location_ar : p.location_en} />
          <DetailRow icon={Building2} label={isRTL ? 'المطور' : 'Developer'} value={isRTL ? p.developer_ar : p.developer_en} />

          {/* Units distribution */}
          <div className="mt-5 mb-4">
            <h3 className="text-sm font-bold text-content dark:text-content-dark m-0 mb-3">
              {isRTL ? 'توزيع الوحدات' : 'Unit Distribution'}
            </h3>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-content-muted dark:text-content-muted-dark mb-1.5">
                <span>{isRTL ? 'نسبة البيع' : 'Sold Rate'}</span>
                <span className="font-bold" style={{ color: statusCfg.color }}>{soldPercent}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden flex">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${soldPercent}%`, background: statusCfg.color }}
                />
              </div>
            </div>

            {/* Unit stat boxes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3 text-center">
                <p className="text-lg font-bold text-content dark:text-content-dark m-0">{p.units_total}</p>
                <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0 mt-0.5">{isRTL ? 'إجمالي' : 'Total'}</p>
              </div>
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3 text-center">
                <p className="text-lg font-bold m-0" style={{ color: statusCfg.color }}>{p.units_sold}</p>
                <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0 mt-0.5">{isRTL ? 'مباع' : 'Sold'}</p>
              </div>
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3 text-center">
                <p className="text-lg font-bold text-content dark:text-content-dark m-0">{p.units_available}</p>
                <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0 mt-0.5">{isRTL ? 'متاح' : 'Available'}</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-5">
            <h3 className="text-sm font-bold text-content dark:text-content-dark m-0 mb-3">
              {isRTL ? 'نطاق الأسعار' : 'Price Range'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3">
                <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{isRTL ? 'من' : 'From'}</p>
                <p className="text-sm font-bold text-content dark:text-content-dark m-0 mt-0.5">
                  {fmtMoney(p.price_from)} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
              <div className="rounded-xl border border-edge dark:border-edge-dark p-3">
                <p className="text-[10px] text-content-muted dark:text-content-muted-dark m-0">{isRTL ? 'إلى' : 'To'}</p>
                <p className="text-sm font-bold text-content dark:text-content-dark m-0 mt-0.5">
                  {fmtMoney(p.price_to)} {isRTL ? 'ج.م' : 'EGP'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
