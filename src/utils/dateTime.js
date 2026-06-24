// Timezone-safe "today" helpers.
//
// The bug they fix: `new Date().toISOString().slice(0,10)` returns the UTC
// calendar date. For a UTC+ timezone (Cairo +2/+3) that is a day BEHIND for the
// first couple of hours after local midnight — so "today" filters and date
// comparisons silently shift by a day in that window. These use the browser's
// LOCAL calendar date (= the team's Cairo date), which is what those comparisons
// actually mean. Use these instead of `.toISOString().slice(0,10)` whenever the
// value is compared/filtered (not for filenames or stored record defaults).

// Local calendar date as YYYY-MM-DD.
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// First day (YYYY-MM-DD) of the local month containing `d`.
export function localMonthStartStr(d = new Date()) {
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Last day (YYYY-MM-DD) of the local month containing `d`.
export function localMonthEndStr(d = new Date()) {
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Local-day boundaries as ISO timestamps (UTC instants of local midnight), for
// .gte/.lt timestamp filters and RPC params so client + server agree on "today".
export function localDayBounds(d = new Date()) {
  const todayStart = new Date(d); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return { todayStart: todayStart.toISOString(), tomorrowStart: tomorrowStart.toISOString() };
}
