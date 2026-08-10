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
  // Window a bit wider than the cron interval so jitter never drops a follow-up;
  // the dedup guard below absorbs the resulting overlap.
  const windowStartISO = new Date(now.getTime() - 20 * 60000).toISOString();
  const dedupSinceISO = new Date(now.getTime() - 2 * 3600000).toISOString();

  // Follow-ups that just became due in the last window, on live non-dead leads.
  const { data: due, error } = await supabase
    .from("contacts")
    .select("id, full_name, assigned_to, assigned_to_name, next_follow_up_at")
    .not("next_follow_up_at", "is", null)
    .gt("next_follow_up_at", windowStartISO)
    .lte("next_follow_up_at", nowISO)
    .neq("contact_status", "disqualified")
    .not("assigned_to", "is", null)
    .or("is_deleted.is.null,is_deleted.eq.false");

  if (error) return json({ error: error.message, sent: 0 });
  if (!due?.length) return json({ sent: 0 });

  // Dedup: skip any lead already pinged (instant follow-up) in the last 2 hours.
  const { data: recent } = await supabase
    .from("notifications")
    .select("url")
    .eq("type", "followup_due")
    .gte("created_at", dedupSinceISO);
  const pinged = new Set(
    (recent || [])
      .map((n: any) => (n.url || "").match(/highlight=([0-9a-fA-F-]+)/)?.[1])
      .filter(Boolean),
  );

  const rows = due
    .filter((c: any) => !pinged.has(c.id))
    .map((c: any) => ({
      type: "followup_due",
      title_ar: "متابعة مستحقة دلوقتي",
      title_en: "Follow-up Due Now",
      body_ar: `حان موعد متابعة "${c.full_name || "عميل"}"`,
      body_en: `Follow-up due now: "${c.full_name || "lead"}"`,
      url: `/contacts?highlight=${c.id}`,
      for_user_id: c.assigned_to,
      for_user_name: c.assigned_to_name,
      created_at: nowISO,
    }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (insErr) return json({ error: insErr.message, sent: 0 });
  }

  return json({ sent: rows.length, scanned: due.length });
});
