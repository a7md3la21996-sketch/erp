// Optimistic-update rollback that respects realtime updates.
//
// The race we guard against:
//   1. User triggers an optimistic update for contact X.
//   2. Before the server responds, a realtime event arrives with a newer
//      version of X (e.g. another agent changed something).
//   3. The original server call fails — we want to roll back our optimistic
//      change, but a naive `prev.map(c => c.id === X.id ? oldX : c)` would
//      overwrite the realtime update with stale data.
//
// Strategy: skip the rollback if the row currently in state has a newer
// updated_at than the snapshot we took before the optimistic update. The
// realtime payload reflects the actual DB state, which is more authoritative
// than our pre-optimistic snapshot.
//
// `previous` is the row as it looked *before* the optimistic update. Pass
// undefined/null to opt out (we just leave state alone).
export function rollbackById(prev, previous) {
  if (!previous || !previous.id) return prev;
  return prev.map(c => {
    if (c.id !== previous.id) return c;
    const cTime = new Date(c.updated_at || c.created_at || 0).getTime();
    const prevTime = new Date(previous.updated_at || previous.created_at || 0).getTime();
    // Realtime brought in something newer — leave it alone.
    if (cTime > prevTime) return c;
    return previous;
  });
}

// Backwards-compatible alias for the original Contacts call sites.
export const rollbackContact = rollbackById;

// Bulk version — restores only the IDs that failed, leaving successful
// rows untouched and respecting realtime newer-than-snapshot rule for each.
// `previousById` is a Map<id, prevRow>. `failedIds` is the subset that
// should be reverted.
export function rollbackManyById(prev, previousById, failedIds) {
  const failedSet = new Set(failedIds.map(String));
  return prev.map(c => {
    if (!failedSet.has(String(c.id))) return c;
    const previous = previousById.get(c.id) || previousById.get(String(c.id));
    if (!previous) return c;
    const cTime = new Date(c.updated_at || c.created_at || 0).getTime();
    const prevTime = new Date(previous.updated_at || previous.created_at || 0).getTime();
    if (cTime > prevTime) return c;
    return previous;
  });
}
