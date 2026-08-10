// Supabase Edge Function: daily-alerts
// Runs daily (via cron) to send alerts for overdue tasks, stale leads, inactive agents
// Schedule: Call via Supabase cron or external scheduler (e.g., cron-job.org)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const nowISO = now.toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  // End of "today" in Cairo — follow-ups are bucketed by the local business day
  // (the app uses the Cairo day, not UTC), so "due today or overdue" = before the
  // start of tomorrow in Cairo.
  const cairoNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const cairoTomorrow = new Date(cairoNow); cairoTomorrow.setHours(24, 0, 0, 0);
  const tzOffsetMs = now.getTime() - cairoNow.getTime();
  const endOfTodayISO = new Date(cairoTomorrow.getTime() + tzOffsetMs).toISOString();
  const results: string[] = [];

  // Get all active sales users with their teams
  const { data: agents } = await supabase
    .from("users")
    .select("id, full_name_en, full_name_ar, role, team_id")
    .in("role", ["sales_agent", "team_leader"])
    .eq("status", "active")
    .not("full_name_en", "ilike", "%Former%");

  if (!agents?.length) {
    return new Response(JSON.stringify({ message: "No active agents", results }));
  }

  for (const agent of agents) {
    const agentName = agent.full_name_en || agent.full_name_ar;
    if (!agentName) continue;

    // 1. Overdue Tasks
    const { count: overdueCount } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", agent.id)
      .eq("status", "pending")
      .lt("due_date", nowISO);

    if (overdueCount && overdueCount > 0) {
      await supabase.from("notifications").insert([{
        type: "overdue_tasks",
        title_ar: "مهام متأخرة",
        title_en: "Overdue Tasks",
        body_ar: `عندك ${overdueCount} مهمة متأخرة محتاجة متابعة`,
        body_en: `You have ${overdueCount} overdue tasks that need attention`,
        url: "/tasks",
        for_user_id: agent.id,
        for_user_name: agentName,
        created_at: nowISO,
      }]);
      results.push(`${agentName}: ${overdueCount} overdue tasks`);
    }

    // 1b. Follow-ups due (overdue + today). Reads contacts.next_follow_up_at —
    // the current home of follow-ups after they left the tasks table. This is
    // why setting a follow-up date used to produce NO notification: the alert
    // engine only looked at `tasks`, which follow-ups no longer populate.
    const { count: followupCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", agent.id)
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", endOfTodayISO)
      .neq("contact_status", "disqualified")
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (followupCount && followupCount > 0) {
      await supabase.from("notifications").insert([{
        type: "followups_due",
        title_ar: "متابعات مستحقة",
        title_en: "Follow-ups Due",
        body_ar: `عندك ${followupCount} متابعة مستحقة النهاردة أو متأخرة`,
        body_en: `You have ${followupCount} follow-ups due today or overdue`,
        url: "/contacts?followup=overdue",
        for_user_id: agent.id,
        for_user_name: agentName,
        created_at: nowISO,
      }]);
      results.push(`${agentName}: ${followupCount} follow-ups due`);
    }

    // 2. Stale Leads (no activity > 3 days). Was gated on contact_status='active'
    // — a status that doesn't exist (valid: new/contacted/following/
    // has_opportunity/disqualified) — so it never fired. Now: any live,
    // non-disqualified lead with no activity for 3+ days.
    const { count: staleCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", agent.id)
      .neq("contact_status", "disqualified")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .lt("last_activity_at", threeDaysAgo);

    if (staleCount && staleCount > 0) {
      await supabase.from("notifications").insert([{
        type: "stale_leads",
        title_ar: "ليدز محتاجة متابعة",
        title_en: "Leads Need Follow-up",
        body_ar: `عندك ${staleCount} ليد بدون نشاط من أكتر من 3 أيام`,
        body_en: `You have ${staleCount} leads with no activity for 3+ days`,
        url: "/contacts",
        for_user_id: agent.id,
        for_user_name: agentName,
        created_at: nowISO,
      }]);
      results.push(`${agentName}: ${staleCount} stale leads`);
    }
  }

  // 3. Inactive Agents (for managers) — agents with no activity for 2+ days
  const { data: activities } = await supabase
    .from("activities")
    .select("user_id, user_name_en")
    .gte("created_at", twoDaysAgo);

  const activeAgentIds = new Set((activities || []).map((a: any) => a.user_id).filter(Boolean));

  // Get managers
  const { data: managers } = await supabase
    .from("users")
    .select("id, full_name_en, team_id")
    .in("role", ["sales_manager", "team_leader"])
    .eq("status", "active");

  for (const manager of (managers || [])) {
    const teamAgents = agents.filter((a: any) => a.team_id === manager.team_id && a.id !== manager.id);
    const inactiveAgents = teamAgents.filter((a: any) => !activeAgentIds.has(a.id));

    if (inactiveAgents.length > 0) {
      const names = inactiveAgents.map((a: any) => a.full_name_en || a.full_name_ar).join(", ");
      await supabase.from("notifications").insert([{
        type: "agent_inactive",
        title_ar: "سيلز غير نشط",
        title_en: "Inactive Agents",
        body_ar: `${inactiveAgents.length} سيلز بدون نشاط من يومين: ${names}`,
        body_en: `${inactiveAgents.length} agents inactive for 2 days: ${names}`,
        url: "/settings/hierarchy",
        for_user_id: manager.id,
        for_user_name: manager.full_name_en,
        created_at: nowISO,
      }]);
      results.push(`Manager ${manager.full_name_en}: ${inactiveAgents.length} inactive agents`);
    }
  }

  // 4. Contact Birthdays
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: birthdays } = await supabase
    .from("contacts")
    .select("id, full_name, birth_date, assigned_to_names")
    .not("birth_date", "is", null)
    .not("assigned_to_names", "is", null);

  for (const c of (birthdays || [])) {
    if (!c.birth_date) continue;
    const bMMDD = c.birth_date.slice(5, 10); // "MM-DD"
    if (bMMDD !== todayMMDD) continue;
    const assignedAgents = Array.isArray(c.assigned_to_names) ? c.assigned_to_names : [];
    for (const agentName of assignedAgents) {
      // Find agent user
      const agent = agents.find((a: any) => a.full_name_en === agentName || a.full_name_ar === agentName);
      if (!agent) continue;
      await supabase.from("notifications").insert([{
        type: "birthday",
        title_ar: "عيد ميلاد عميل",
        title_en: "Client Birthday",
        body_ar: `النهارده عيد ميلاد "${c.full_name}" — ابعتله تهنئة!`,
        body_en: `Today is "${c.full_name}"'s birthday — send a greeting!`,
        url: `/contacts?highlight=${c.id}`,
        for_user_id: agent.id,
        for_user_name: agentName,
        created_at: nowISO,
      }]);
      results.push(`Birthday: ${c.full_name} → ${agentName}`);
    }
  }

  // 5. Hot leads with no activity for 3+ days (grouped per agent). Repointed from
  // the retired `opportunities` table to hot-temperature contacts.
  const { data: hotOpps } = await supabase
    .from("contacts")
    .select("id, full_name, assigned_to_name, temperature, last_activity_at")
    .eq("temperature", "hot")
    .neq("contact_status", "disqualified")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .lt("last_activity_at", threeDaysAgo);

  const hotByAgent: Record<string, number> = {};
  (hotOpps || []).forEach((opp: any) => {
    if (opp.assigned_to_name) hotByAgent[opp.assigned_to_name] = (hotByAgent[opp.assigned_to_name] || 0) + 1;
  });

  for (const [agentName, count] of Object.entries(hotByAgent)) {
    const agent = agents.find((a: any) => a.full_name_en === agentName || a.full_name_ar === agentName);
    if (!agent) continue;
    await supabase.from("notifications").insert([{
      type: "hot_opportunity",
      title_ar: "فرص ساخنة محتاجة متابعة",
      title_en: "Hot Opportunities Need Follow-up",
      body_ar: `عندك ${count} ليد ساخن بدون نشاط من 3 أيام`,
      body_en: `You have ${count} hot leads with no activity for 3 days`,
      url: "/contacts?temperature=hot",
      for_user_id: agent.id,
      for_user_name: agentName,
      created_at: nowISO,
    }]);
    results.push(`Hot opps: ${count} → ${agentName}`);
  }

  // 6. Daily Summary for Managers
  for (const manager of (managers || [])) {
    const teamAgents = agents.filter((a: any) => a.team_id === manager.team_id && a.id !== manager.id);
    const teamIds = teamAgents.map((a: any) => a.id);
    if (!teamIds.length) continue;

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const { count: todayActivities } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("user_id", teamIds)
      .gte("created_at", todayStart.toISOString());

    const { count: todayOpps } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .in("agent_en", teamAgents.map((a: any) => a.full_name_en).filter(Boolean))
      .gte("created_at", todayStart.toISOString());

    await supabase.from("notifications").insert([{
      type: "daily_summary",
      title_ar: "ملخص اليوم",
      title_en: "Daily Summary",
      body_ar: `فريقك النهارده: ${todayActivities || 0} نشاط، ${todayOpps || 0} صفقة جديدة`,
      body_en: `Your team today: ${todayActivities || 0} activities, ${todayOpps || 0} new deals`,
      url: "/dashboard",
      for_user_id: manager.id,
      for_user_name: manager.full_name_en,
      created_at: nowISO,
    }]);
    results.push(`Summary → ${manager.full_name_en}`);
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
