// Supabase Edge Function: send-push
// Sends Firebase Cloud Messaging (FCM) push notifications to users
// Triggered by Database Webhook on `notifications` table INSERT

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(
  Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}"
);

const PROJECT_ID = FIREBASE_SERVICE_ACCOUNT.project_id;
const CLIENT_EMAIL = FIREBASE_SERVICE_ACCOUNT.client_email;
const PRIVATE_KEY = FIREBASE_SERVICE_ACCOUNT.private_key?.replace(/\\n/g, "\n");

// Cache access token
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60000) {
    return _tokenCache.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(PRIVATE_KEY, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(CLIENT_EMAIL)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error("Failed to get access token: " + JSON.stringify(data));
  }

  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function sendPush(token: string, title: string, body: string, data: Record<string, string> = {}) {
  const accessToken = await getAccessToken();
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          webpush: {
            notification: {
              icon: "/pwa-192.png",
              badge: "/pwa-192.png",
              vibrate: [200, 100, 200],
            },
            fcm_options: { link: data.url || "/" },
          },
        },
      }),
    }
  );
  return { ok: resp.ok, status: resp.status, body: await resp.text() };
}

serve(async (req) => {
  try {
    if (!PROJECT_ID) {
      return new Response("FIREBASE_SERVICE_ACCOUNT not configured", { status: 500 });
    }

    const payload = await req.json();
    // Database webhook sends: { type, table, record, schema, old_record }
    const record = payload.record || payload;
    if (!record) return new Response("No record", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve target user(s) — support for_user_id (UUID) or for_user_name (name)
    let targetTokens: string[] = [];

    // Helper: extract all tokens from a user row (single + array)
    const extractTokens = (u: any): string[] => {
      const tokens: string[] = [];
      if (u.fcm_token) tokens.push(u.fcm_token);
      if (Array.isArray(u.fcm_tokens)) u.fcm_tokens.forEach((t: string) => { if (t && !tokens.includes(t)) tokens.push(t); });
      return tokens;
    };

    if (record.for_user_id && record.for_user_id !== "all") {
      const { data: user } = await supabase
        .from("users")
        .select("fcm_token, fcm_tokens")
        .eq("id", record.for_user_id)
        .maybeSingle();
      if (user) targetTokens.push(...extractTokens(user));
    } else if (record.for_user_name) {
      const { data: users } = await supabase
        .from("users")
        .select("fcm_token, fcm_tokens")
        .or(`full_name_en.eq.${record.for_user_name},full_name_ar.eq.${record.for_user_name}`);
      (users || []).forEach((u: any) => targetTokens.push(...extractTokens(u)));
    } else if (record.for_user_id === "all") {
      const { data: users } = await supabase
        .from("users")
        .select("fcm_token, fcm_tokens")
        .not("fcm_token", "is", null)
        .eq("status", "active");
      (users || []).forEach((u: any) => targetTokens.push(...extractTokens(u)));
    }
    // Deduplicate tokens
    targetTokens = [...new Set(targetTokens)];

    if (!targetTokens.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no target tokens" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Determine title/body (prefer Arabic, fallback to English)
    const title = record.title_ar || record.title_en || "Platform ERP";
    const body = record.body_ar || record.body_en || "";
    const data = {
      url: record.url || "/",
      type: record.type || "info",
      notification_id: String(record.id || ""),
    };

    // Send to all tokens in parallel
    const results = await Promise.all(
      targetTokens.map((token) => sendPush(token, title, body, data).catch((e) => ({ ok: false, error: String(e) })))
    );

    const sent = results.filter((r: any) => r.ok).length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
