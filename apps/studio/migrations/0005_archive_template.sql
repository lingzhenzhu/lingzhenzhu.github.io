-- Archive views become an explicit page template. Afterwards no module setting decides what a page is.
-- One-time: a standalone page outside navigation whose blocks are all date-filtered article lists
-- (the legacy /archives/YYYY/ and /archives/YYYY/MM/ pages). History is converted too, so restoring
-- an older revision does not bring the inferred identity back.
UPDATE content_resources SET document = json_set(document, '$.template', 'archive')
WHERE key LIKE 'page:%' AND document IS NOT NULL
  AND json_extract(document, '$.template') = 'page'
  AND coalesce(json_extract(document, '$.inNavigation'), 0) = 0
  AND json_array_length(document, '$.blocks') > 0
  AND NOT EXISTS (
    SELECT 1 FROM json_each(content_resources.document, '$.blocks') b
    WHERE json_extract(b.value, '$.type') NOT IN ('archive', 'articleSearch')
      OR (coalesce(json_extract(b.value, '$.year'), '') = '' AND coalesce(json_extract(b.value, '$.month'), '') = '')
  );
UPDATE resource_versions SET document = json_set(document, '$.template', 'archive')
WHERE key LIKE 'page:%' AND document IS NOT NULL
  AND json_extract(document, '$.template') = 'page'
  AND coalesce(json_extract(document, '$.inNavigation'), 0) = 0
  AND json_array_length(document, '$.blocks') > 0
  AND NOT EXISTS (
    SELECT 1 FROM json_each(resource_versions.document, '$.blocks') b
    WHERE json_extract(b.value, '$.type') NOT IN ('archive', 'articleSearch')
      OR (coalesce(json_extract(b.value, '$.year'), '') = '' AND coalesce(json_extract(b.value, '$.month'), '') = '')
  );
