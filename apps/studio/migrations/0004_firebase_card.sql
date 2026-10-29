-- Provider migration for the one existing card. This does not contact Firebase or alter balances/history.
-- Convert historical representations too, so restoring a draft does not revert its provider.
UPDATE content_resources SET document = json_set(document, '$.blocks', (
  SELECT json_group_array(json(CASE
    WHEN json_extract(b.value,'$.id')='request-application' AND json_extract(b.value,'$.type')='rewards'
    THEN json_object('id','request-application','version',1,'type','firebaseRewards','hidden',json('false'))
    ELSE b.value END)) FROM json_each(content_resources.document,'$.blocks') b
)) WHERE key LIKE 'page:%' AND EXISTS (
  SELECT 1 FROM json_each(content_resources.document,'$.blocks') b
  WHERE json_extract(b.value,'$.id')='request-application' AND json_extract(b.value,'$.type')='rewards'
);
UPDATE resource_versions SET document = json_set(document, '$.blocks', (
  SELECT json_group_array(json(CASE
    WHEN json_extract(b.value,'$.id')='request-application' AND json_extract(b.value,'$.type')='rewards'
    THEN json_object('id','request-application','version',1,'type','firebaseRewards','hidden',json('false'))
    ELSE b.value END)) FROM json_each(resource_versions.document,'$.blocks') b
)) WHERE key LIKE 'page:%' AND EXISTS (
  SELECT 1 FROM json_each(resource_versions.document,'$.blocks') b
  WHERE json_extract(b.value,'$.id')='request-application' AND json_extract(b.value,'$.type')='rewards'
);
