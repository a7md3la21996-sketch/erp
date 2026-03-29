/**
 * Feature Flags
 * Toggle features on/off without removing code.
 *
 * OFFLINE_MODE: false = Supabase only (recommended for production)
 *               true  = localStorage fallback enabled
 */
export const FEATURES = {
  OFFLINE_MODE: false,  // DISABLED — Supabase is single source of truth
};
