// Lead ORIGIN categories — describe WHERE a lead came from. Permanent, and
// distinct from contact_status (transient work state) and contact_type
// (lead / customer relationship kind). Backed by the contacts.lead_category
// column (see supabase/migrations/add_lead_category_column.sql).
//
// Single source of truth for the badge + filter on the Leads page. Step 4 of
// the lead-classification plan makes these editable in Settings; until then
// they're the fixed defaults below.

export const LEAD_CATEGORIES = [
  { key: 'fresh',       label_ar: 'فريش',       label_en: 'Fresh',       color: '#158A57' }, // green
  { key: 'rotation',    label_ar: 'روتيشن',     label_en: 'Rotation',    color: '#2F6BD3' }, // blue
  { key: 'distributed', label_ar: 'موزّع',      label_en: 'Distributed', color: '#5A63C4' }, // purple
  { key: 'cold_calls',  label_ar: 'كولد كول',   label_en: 'Cold Calls',  color: '#6B7280' }, // gray
];

export const LEAD_CATEGORY_MAP = Object.fromEntries(
  LEAD_CATEGORIES.map((c) => [c.key, c]),
);

// Label for a category key in the active language; falls back to the raw key
// so an unknown / legacy value still renders something meaningful. Pass the
// editable list from useSystemConfig().leadCategories to honour admin renames;
// omit it to use the built-in defaults.
export function leadCategoryLabel(key, isRTL, categories) {
  const list = (categories && categories.length) ? categories : LEAD_CATEGORIES;
  const c = list.find((x) => x.key === key);
  if (!c) return key || '';
  return isRTL ? c.label_ar : c.label_en;
}

export function leadCategoryColor(key, categories) {
  const list = (categories && categories.length) ? categories : LEAD_CATEGORIES;
  return list.find((x) => x.key === key)?.color || '#6B7280';
}
