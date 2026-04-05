-- ============================================================
-- Migration: Recreate messaging & approval tables to match
-- service layer column names (post-localStorage → Supabase conversion)
--
-- The original schema.sql defined these tables with uuid PKs and
-- FK references, but the converted services use text IDs (genId())
-- and different column names.  This migration drops the old
-- (likely empty) tables and recreates them with the correct shape.
-- ============================================================

-- ── WhatsApp Templates ───────────────────────────────────────
DROP TABLE IF EXISTS whatsapp_templates CASCADE;
CREATE TABLE whatsapp_templates (
  id          text PRIMARY KEY,
  name        text,
  name_ar     text,
  category    text,
  body        text,
  body_ar     text,
  variables   jsonb DEFAULT '[]',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on whatsapp_templates"
  ON whatsapp_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_whatsapp_templates_category  ON whatsapp_templates (category);
CREATE INDEX idx_whatsapp_templates_active    ON whatsapp_templates (is_active);

-- ── WhatsApp Messages ────────────────────────────────────────
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
CREATE TABLE whatsapp_messages (
  id            text PRIMARY KEY,
  contact_id    text,
  contact_name  text,
  contact_phone text,
  direction     text DEFAULT 'outgoing',
  message       text,
  template_id   text,
  sent_at       timestamptz DEFAULT now(),
  status        text DEFAULT 'sent',
  type          text DEFAULT 'text',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on whatsapp_messages"
  ON whatsapp_messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_whatsapp_messages_contact   ON whatsapp_messages (contact_id);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages (direction);
CREATE INDEX idx_whatsapp_messages_sent_at   ON whatsapp_messages (sent_at DESC);

-- ── Emails ───────────────────────────────────────────────────
DROP TABLE IF EXISTS emails CASCADE;
CREATE TABLE emails (
  id              text PRIMARY KEY,
  "from"          text,
  "to"            text,
  to_name         text,
  subject         text,
  body            text,
  sent_at         timestamptz DEFAULT now(),
  read            boolean DEFAULT false,
  starred         boolean DEFAULT false,
  folder          text DEFAULT 'inbox',
  contact_id      text,
  opportunity_id  text,
  thread_id       text,
  attachments     jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on emails"
  ON emails FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_emails_folder       ON emails (folder);
CREATE INDEX idx_emails_contact      ON emails (contact_id);
CREATE INDEX idx_emails_opportunity  ON emails (opportunity_id);
CREATE INDEX idx_emails_thread       ON emails (thread_id);
CREATE INDEX idx_emails_sent_at      ON emails (sent_at DESC);
CREATE INDEX idx_emails_starred      ON emails (starred) WHERE starred = true;
CREATE INDEX idx_emails_unread       ON emails (read) WHERE read = false;

-- ── Email Templates ──────────────────────────────────────────
DROP TABLE IF EXISTS email_templates CASCADE;
CREATE TABLE email_templates (
  id          text PRIMARY KEY,
  name        text,
  name_ar     text,
  subject     text,
  subject_ar  text,
  body        text,
  body_ar     text,
  category    text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on email_templates"
  ON email_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_email_templates_category ON email_templates (category);

-- ── SMS Templates ────────────────────────────────────────────
-- Note: service uses camelCase columns (nameAr, bodyAr) not snake_case
DROP TABLE IF EXISTS sms_templates CASCADE;
CREATE TABLE sms_templates (
  id          text PRIMARY KEY,
  name        text,
  "nameAr"    text,
  body        text,
  "bodyAr"    text,
  category    text,
  variables   jsonb DEFAULT '[]',
  send_count  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on sms_templates"
  ON sms_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_sms_templates_category ON sms_templates (category);

-- ── SMS Log ──────────────────────────────────────────────────
DROP TABLE IF EXISTS sms_log CASCADE;
CREATE TABLE sms_log (
  id            text PRIMARY KEY,
  phone         text,
  message       text,
  template_id   text,
  template_name text,
  status        text DEFAULT 'sent',
  sent_at       timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on sms_log"
  ON sms_log FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_sms_log_template  ON sms_log (template_id);
CREATE INDEX idx_sms_log_sent_at   ON sms_log (sent_at DESC);

-- ── Chat Messages ────────────────────────────────────────────
DROP TABLE IF EXISTS chat_messages CASCADE;
CREATE TABLE chat_messages (
  id          text PRIMARY KEY,
  entity      text,
  entity_id   text,
  entity_name text,
  text        text,
  author_id   text,
  author_name text,
  mentions    jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  edited_at   timestamptz
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on chat_messages"
  ON chat_messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_chat_messages_entity     ON chat_messages (entity, entity_id);
CREATE INDEX idx_chat_messages_author     ON chat_messages (author_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages (created_at DESC);

-- ── Approvals ────────────────────────────────────────────────
-- Service uses text id from genId() via .insert().select().single()
-- but also uses Supabase-generated id. Use text PK for consistency.
DROP TABLE IF EXISTS approvals CASCADE;
CREATE TABLE approvals (
  id                text PRIMARY KEY DEFAULT (
    substr(md5(random()::text || clock_timestamp()::text), 1, 20)
  ),
  type              text,
  entity_type       text,
  entity_id         text,
  entity_name       text,
  requested_by      text,
  requested_by_name text,
  approved_by       text,
  approver_name     text,
  amount            numeric DEFAULT 0,
  status            text DEFAULT 'pending',
  priority          text DEFAULT 'normal',
  comment           text,
  comments          text,
  resolved_at       timestamptz,
  approved_at       timestamptz,
  rejected_at       timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access on approvals"
  ON approvals FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_approvals_status       ON approvals (status);
CREATE INDEX idx_approvals_type         ON approvals (type);
CREATE INDEX idx_approvals_entity       ON approvals (entity_id);
CREATE INDEX idx_approvals_requested_by ON approvals (requested_by);
CREATE INDEX idx_approvals_approved_by  ON approvals (approved_by);
CREATE INDEX idx_approvals_priority     ON approvals (priority);
CREATE INDEX idx_approvals_created_at   ON approvals (created_at DESC);
