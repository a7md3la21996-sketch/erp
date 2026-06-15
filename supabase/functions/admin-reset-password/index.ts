// Supabase Edge Function: admin-reset-password
//
// Lets an ADMIN reset another user's password. Changing a password requires the
// Supabase Admin API (auth.admin.updateUserById), which needs the service_role
// key — that key must NEVER reach the browser. The old in-app code called the
// admin API directly from the client with the anon key, so it always failed
// silently and the password was never actually changed.
//
// This function runs server-side with the service_role key and:
//   1) identifies the caller from their JWT (sent automatically by
//      supabase.functions.invoke),
//   2) verifies the caller is an ACTIVE admin,
//   3) only then changes the target user's password.
//
// Deploy:  supabase functions deploy admin-reset-password
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const token = (req.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return json({ ok: false, error: "Missing authorization" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Who is calling? Validate the caller's JWT.
    const { data: { user: caller }, error: callerErr } = await admin.auth
      .getUser(token);
    if (callerErr || !caller) {
      return json({ ok: false, error: "Invalid session" }, 401);
    }

    // 2) Caller must be an ACTIVE admin.
    const { data: callerRow, error: roleErr } = await admin
      .from("users")
      .select("role, status, is_active")
      .eq("id", caller.id)
      .maybeSingle();
    if (roleErr) {
      return json({ ok: false, error: "Could not verify caller" }, 200);
    }
    const callerActive = !!callerRow &&
      callerRow.status !== "inactive" &&
      callerRow.is_active !== false;
    if (!callerRow || callerRow.role !== "admin" || !callerActive) {
      return json({ ok: false, error: "Admin privileges required" }, 200);
    }

    // 3) Validate input.
    const { userId, newPassword } = await req.json().catch(() => ({}));
    if (
      !userId || typeof newPassword !== "string" || newPassword.length < 6
    ) {
      return json({
        ok: false,
        error: "userId and newPassword (min 6 chars) are required",
      }, 200);
    }

    // 4) Change the target user's password.
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updErr) return json({ ok: false, error: updErr.message }, 200);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
