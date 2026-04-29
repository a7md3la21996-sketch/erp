// Name → user_id resolver. Handles English, Arabic, normalized variants.
// Used across all migration scripts.

export function buildResolver(users) {
  const enMap = new Map();
  const arMap = new Map();
  const normMap = new Map();

  const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  for (const u of users) {
    if (u.full_name_en) enMap.set(u.full_name_en, u);
    if (u.full_name_ar) arMap.set(u.full_name_ar, u);
    if (u.full_name_en) normMap.set(norm(u.full_name_en), u);
    if (u.full_name_ar) normMap.set(norm(u.full_name_ar), u);
  }

  return function resolve(name) {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    // Exact en
    if (enMap.has(trimmed)) {
      const u = enMap.get(trimmed);
      return { user_id: u.id, user: u, matched_via: 'en_exact', canonical_en: u.full_name_en, canonical_ar: u.full_name_ar };
    }
    // Exact ar
    if (arMap.has(trimmed)) {
      const u = arMap.get(trimmed);
      return { user_id: u.id, user: u, matched_via: 'ar_exact', canonical_en: u.full_name_en, canonical_ar: u.full_name_ar };
    }
    // Normalized
    const n = norm(trimmed);
    if (normMap.has(n)) {
      const u = normMap.get(n);
      return { user_id: u.id, user: u, matched_via: 'normalized', canonical_en: u.full_name_en, canonical_ar: u.full_name_ar };
    }
    return null;
  };
}
