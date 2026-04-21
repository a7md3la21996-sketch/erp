# Push Notifications Setup

## Overview
This Edge Function sends push notifications to users via Firebase Cloud Messaging (FCM) when a new row is inserted into the `notifications` table.

## Setup Steps

### 1. Get Firebase Service Account
1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project
2. Click the gear icon → **Project Settings**
3. Go to **Service Accounts** tab
4. Click **Generate new private key** — downloads a JSON file
5. Open the JSON file and copy its **entire contents**

### 2. Set Supabase Secret
In Supabase Dashboard → Edge Functions → Secrets (or via CLI):

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<paste entire JSON content>'
```

Or via Dashboard UI: paste the full JSON as the secret value.

### 3. Deploy the Edge Function

**Via Supabase CLI:**
```bash
supabase functions deploy send-push
```

**Via Dashboard:**
1. Edge Functions → New Function
2. Name: `send-push`
3. Copy-paste content of `index.ts`
4. Deploy

### 4. Create Database Webhook

In Supabase Dashboard → Database → Webhooks → Create Webhook:

- **Name:** `notify_push_on_insert`
- **Table:** `notifications`
- **Events:** `INSERT`
- **Type:** `HTTP Request`
- **Method:** `POST`
- **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push`
- **Headers:**
  - `Authorization: Bearer YOUR_ANON_KEY` (or Service Role Key)
  - `Content-Type: application/json`
- **HTTP Params:** leave empty (the webhook sends record automatically)

### 5. Test
Create a test notification:
```sql
INSERT INTO notifications (title_ar, title_en, body_ar, body_en, for_user_id, type, url)
VALUES ('اختبار', 'Test', 'إشعار تجريبي', 'Test notification', '<USER_UUID>', 'info', '/');
```

If the user has `fcm_token` set, they should receive a push notification.

## How It Works

1. User logs in → browser registers FCM token → saved to `users.fcm_token`
2. App inserts row into `notifications` table
3. Webhook fires, calls this Edge Function
4. Function reads the notification, finds target user(s), sends push via FCM

## Troubleshooting

- **"FIREBASE_SERVICE_ACCOUNT not configured"** → Set the secret
- **No notification received** → Check user has `fcm_token` in DB (may need browser permission + re-login)
- **Edge function errors** → Check logs in Supabase Dashboard → Edge Functions → Logs
