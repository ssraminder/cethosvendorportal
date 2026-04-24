SELECT 'dupes_check' AS check_name, COUNT(*)::text AS value FROM (
  SELECT application_id, source_language_id, target_language_id, domain
  FROM cvp_test_combinations
  GROUP BY 1,2,3,4
  HAVING COUNT(*) > 1
) d
UNION ALL
SELECT 'certified_not_skip_count', COUNT(*)::text
FROM cvp_test_combinations
WHERE domain = 'certified_official' AND status <> 'skip_manual_review'
UNION ALL
SELECT 'service_type_not_null_count', COUNT(*)::text
FROM cvp_test_combinations
WHERE service_type IS NOT NULL
UNION ALL
SELECT 'translator_domains_table_exists',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cvp_translator_domains') THEN 'yes' ELSE 'no' END
UNION ALL
SELECT 'life_sciences_active_rows', COUNT(*)::text
FROM cvp_test_library
WHERE domain = 'life_sciences' AND is_active = true;
