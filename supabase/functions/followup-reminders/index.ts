// Supabase Edge Function: followup-reminders
// Near-real-time follow-up reminders. Runs on a SHORT cron (every ~15 min) and
// fires a per-lead notification the moment a follow-up becomes due — the instant
// complement to the once-a-day digest in `daily-alerts`.
//
// How "instant" works without a per-row scheduler: each run picks up follow-ups
// whose next_follow_up_at fell into the last ~20-minute window. A follow-up's
// due time lands in exactly one window, so it fires once, right after it's due.
// A 2-hour dedup guard (by contact id, read from the notification url) makes
// overlapping windows / missed runs safe against double-notifying.
//
// Schedule: every 15 minutes (Supabase cron / pg_cron / external scheduler).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const nowISO = now.toISOString();
  // ── Tiered appointment reminders ──────────────────────────────────────────
  // Every lead carries ONE next appointment in `next_follow_up_at` — a call, a
  // meeting, a WhatsApp, whatever the rep scheduled. We fire THREE tiers so the
  // rep is warned AHEAD of time, not only the moment it's already due:
  //   • d1  — ~a day before  (heads-up to prepare / travel)
  //   • h1  — ~an hour before
  //   • due — the moment it becomes due (the original behaviour)
  // Each tier's window is matched to the ~15-min cron; a (contact, tier) dedup
  // guard makes overlapping runs / missed runs safe against double-notifying.
  const MIN = 60000, HOUR = 3600000, t0 = now.getTime();
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });

  const tiers = [
    { type: "followup_due", from: t0 - 20 * MIN, to: t0,
      title_ar: "موعد مستحق دلوقتي", title_en: "Appointment due now",
      body: (n: string, _t: string) => [`حان موعد "${n}"`, `Due now: "${n}"`] },
    { type: "followup_soon_1h", from: t0 + 50 * MIN, to: t0 + 70 * MIN,
      title_ar: "موعد بعد ساعة", title_en: "Appointment in 1 hour",
      body: (n: string, t: string) => [`بعد ساعة (${t}) — موعد مع "${n}"`, `In 1 hour (${t}) — "${n}"`] },
    { type: "followup_soon_1d", from: t0 + (24 * HOUR - 20 * MIN), to: t0 + 24 * HOUR,
      title_ar: "موعد بكرة", title_en: "Appointment tomorrow",
      body: (n: string, t: string) => [`بكرة الساعة ${t} — موعد مع "${n}"`, `Tomorrow ${t} — "${n}"`] },
  ];

  // One dedup read covering the widest tier lookback (25h). Keyed by
  // `${type}:${contactId}` read back from the notification url.
  const { data: recent } = await supabase
    .from("notifications")
    .select("type, url")
    .in("type", tiers.map((t) => t.type))
    .gte("created_at", new Date(t0 - 25 * HOUR).toISOString());
  const already = new Set(
    (recent || []).map(
      (n: any) => `${n.type}:${(n.url || "").match(/highlight=([0-9a-fA-F-]+)/)?.[1] || ""}`,
    ),
  );

  const rows: any[] = [];
  for (const tier of tiers) {
    const { data: hits, error } = await supabase
      .from("contacts")
      .select("id, full_name, assigned_to, assigned_to_name, next_follow_up_at")
      .not("next_follow_up_at", "is", null)
      .gt("next_follow_up_at", new Date(tier.from).toISOString())
      .lte("next_follow_up_at", new Date(tier.to).toISOString())
      .neq("contact_status", "disqualified")
      .not("assigned_to", "is", null)
      .or("is_deleted.is.null,is_deleted.eq.false");
    if (error) continue;
    for (const c of hits || []) {
      const dk = `${tier.type}:${c.id}`;
      if (already.has(dk)) continue;
      already.add(dk);
      const [bar, ben] = tier.body(c.full_name || "عميل", fmtTime(c.next_follow_up_at));
      rows.push({
        type: tier.type,
        title_ar: tier.title_ar,
        title_en: tier.title_en,
        body_ar: bar,
        body_en: ben,
        url: `/contacts?highlight=${c.id}`,
        for_user_id: c.assigned_to,
        for_user_name: c.assigned_to_name,
        created_at: nowISO,
      });
    }
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (insErr) return json({ error: insErr.message, sent: 0 });
  }

  return json({ sent: rows.length });
});
