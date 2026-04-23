-- Backfill audit_logs.description for existing rows where the description is
-- generic ("Updated contact", "Created contact", etc.) by rebuilding it from
-- the stored changes JSON. This mirrors the new JS logic in auditService.js
-- so old rows become as informative as new ones without having to expand.
--
-- Idempotent: the WHERE clause excludes rows whose description is already
-- specific, so running it twice is safe.
--
-- Rules:
--   - ≤3 changed fields → inline diff: field: "from" → "to", ...
--   - >3 changed fields → 'Updated <entity>: f1, f2, f3 (+N more)'
--   - Long values truncated at 30 chars (matches JS behavior)

WITH log_descriptions AS (
  SELECT
    al.id,
    al.entity,
    al.changes,
    (SELECT count(*) FROM jsonb_each(al.changes))                         AS field_count,
    (SELECT array_agg(key ORDER BY key) FROM jsonb_each(al.changes))      AS keys,
    -- Inline diff for ≤3-field updates
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
      OR al.description ~ '^(Updated|Created|Deleted)\s+\w+$'
    )
)
UPDATE audit_logs al
SET description = CASE
  WHEN ld.field_count <= 3 THEN ld.inline_diff
  ELSE
    'Updated ' || al.entity || ': ' ||
    array_to_string(ld.keys[1:5], ', ') ||
    CASE WHEN ld.field_count > 5 THEN ' (+' || (ld.field_count - 5) || ' more)' ELSE '' END
END
FROM log_descriptions ld
WHERE al.id = ld.id;

-- Sanity check (uncomment to preview before running):
-- SELECT id, action, entity, description
-- FROM audit_logs
-- WHERE changes IS NOT NULL AND description ~ '^(Updated|Created|Deleted)\s+\w+$'
-- LIMIT 10;
