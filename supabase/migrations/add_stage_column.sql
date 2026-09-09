-- Lead lifecycle: add a derived `stage` column to contacts.
-- One-time, additive, reversible. Populated by DERIVATION from the strongest
-- available evidence per lead: deal > meeting > contact_status.
-- Nothing in the app reads this column yet; it is for staging review only.
--
-- Ladder (stored key -> Arabic label):
--   new         جديد
--   contacted   تم التواصل
--   meeting_set تحديد موعد
--   met         تمت المقابلة
--   reserved    حجز
--   contracted  تعاقد
--   deal_done   صفقة مكتملة
--
-- Rollback:  ALTER TABLE contacts DROP COLUMN stage;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS stage text;

WITH deal_rank AS (
  SELECT contact_id,
         MAX(CASE status
               WHEN 'won'        THEN 7
               WHEN 'contracted' THEN 6
               WHEN 'reserved'   THEN 5
               WHEN 'new_deal'   THEN 4
               ELSE 0 END) AS r
  FROM deals
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
),
meet_rank AS (
  SELECT contact_id,
         MAX(CASE status
               WHEN 'completed' THEN 4
               WHEN 'scheduled' THEN 3
               ELSE 0 END) AS r
  FROM activities
  WHERE type = 'meeting' AND contact_id IS NOT NULL
  GROUP BY contact_id
),
ranked AS (
  SELECT c.id,
         GREATEST(
           COALESCE(d.r, 0),
           COALESCE(m.r, 0),
           CASE c.contact_status
             WHEN 'has_opportunity' THEN 2
             WHEN 'following'       THEN 2
             WHEN 'contacted'       THEN 2
             ELSE 1 END
         ) AS rank
  FROM contacts c
  LEFT JOIN deal_rank d ON d.contact_id = c.id
  LEFT JOIN meet_rank m ON m.contact_id = c.id
)
UPDATE contacts c
SET stage = CASE r.rank
              WHEN 7 THEN 'deal_done'
              WHEN 6 THEN 'contracted'
              WHEN 5 THEN 'reserved'
              WHEN 4 THEN 'met'
              WHEN 3 THEN 'meeting_set'
              WHEN 2 THEN 'contacted'
              ELSE        'new'
            END
FROM ranked r
WHERE r.id = c.id;
