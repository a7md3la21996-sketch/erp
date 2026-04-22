-- Clean internal/client-side fields out of existing audit_logs.changes and
-- regenerate description for the cleaned rows. This mirrors the JS SKIP_FIELDS
-- list so old rows match how new rows are written.
--
-- Idempotent: rows that don't contain any of the listed keys are skipped.

-- Step 1: strip noisy keys from the changes JSONB on every row
UPDATE audit_logs
SET changes = changes
  - '_country'
  - '_campaign_count'
  - '_opp_count'
  - '_agent_count'
  - '_lastNote'
  - '_feedback'
  - '_aging_level'
  - '_offline'
  - '_triggerEdit'
  - '_customFieldValues'
WHERE changes IS NOT NULL
  AND jsonb_typeof(changes) = 'object'
  AND (
       changes ? '_country'
    OR changes ? '_campaign_count'
    OR changes ? '_opp_count'
    OR changes ? '_agent_count'
    OR changes ? '_lastNote'
    OR changes ? '_feedback'
    OR changes ? '_aging_level'
    OR changes ? '_offline'
    OR changes ? '_triggerEdit'
    OR changes ? '_customFieldValues'
  );

-- Step 2: rows that became empty objects after stripping → clear to NULL
UPDATE audit_logs
SET changes = NULL
WHERE changes IS NOT NULL
  AND jsonb_typeof(changes) = 'object'
  AND (SELECT count(*) FROM jsonb_each(changes)) = 0;

-- Step 3: regenerate description for any row whose description was auto-generated
-- from the (now cleaned) changes. Matches rows that look like the auto format.
WITH log_descriptions AS (
  SELECT
    al.id,
    al.entity,
    al.changes,
    (SELECT count(*) FROM jsonb_each(al.changes))                         AS field_count,
    (SELECT array_agg(key ORDER BY key) FROM jsonb_each(al.changes))      AS keys,
    (SELECT string_agg(
        key || ': "' ||
        LEFT(coalesce(value->>'from', '—'), 30) || '" → "' ||
        LEFT(coalesce(value->>'to',   '—'), 30) || '"',
        ', ' ORDER BY key)
     FROM jsonb_each(al.changes))                                          AS inline_diff
  FROM audit_logs al
  WHERE al.changes IS NOT NULL
    AND jsonb_typeof(al.changes) = 'object'
    AND (
      al.description IS NULL
      OR al.description = ''
      OR al.description ~ '^(Updated|Created|Deleted)\s+\w+(\:\s.*)?$'
      OR al.description LIKE '%_country%'
      OR al.description LIKE '%_campaign_count%'
      OR al.description LIKE '%_opp_count%'
      OR al.description LIKE '%_agent_count%'
      OR al.description LIKE '%[object Object]%'
    )
)
UPDATE audit_logs al
SET description = CASE
  WHEN ld.field_count <= 3 THEN ld.inline_diff
  WHEN ld.field_count > 3  THEN
    'Updated ' || al.entity || ': ' ||
    array_to_string(ld.keys[1:5], ', ') ||
    CASE WHEN ld.field_count > 5 THEN ' (+' || (ld.field_count - 5) || ' more)' ELSE '' END
  ELSE al.description
END
FROM log_descriptions ld
WHERE al.id = ld.id;

-- Step 4: rows that had only internal fields before cleanup now have empty changes
-- and a stale description. Reset them to the generic action label.
UPDATE audit_logs
SET description = 'Updated ' || entity
WHERE changes IS NULL
  AND (
       description LIKE '%_country%'
    OR description LIKE '%_campaign_count%'
    OR description LIKE '%_opp_count%'
    OR description LIKE '%_agent_count%'
    OR description LIKE '%[object Object]%'
  );
