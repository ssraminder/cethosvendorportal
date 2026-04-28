SELECT 'application_status' AS check, status::text AS value
FROM cvp_applications WHERE id='22222222-2222-4222-8222-222222222222'
UNION ALL
SELECT 'combos_total', COUNT(*)::text FROM cvp_test_combinations
WHERE application_id='22222222-2222-4222-8222-222222222222'
UNION ALL
SELECT 'combos_approved', COUNT(*)::text FROM cvp_test_combinations
WHERE application_id='22222222-2222-4222-8222-222222222222' AND status='approved'
UNION ALL
SELECT 'translator_domains_total', COUNT(*)::text FROM cvp_translator_domains
WHERE translator_id='f9b86425-bc9a-4789-a953-a43167eb99f2'
UNION ALL
SELECT 'translator_domains_application', COUNT(*)::text FROM cvp_translator_domains
WHERE translator_id='f9b86425-bc9a-4789-a953-a43167eb99f2' AND approval_source='application'
UNION ALL
SELECT 'translator_domains_staff_manual', COUNT(*)::text FROM cvp_translator_domains
WHERE translator_id='f9b86425-bc9a-4789-a953-a43167eb99f2' AND approval_source='staff_manual'
UNION ALL
SELECT 'submissions_submitted', COUNT(*)::text FROM cvp_test_submissions
WHERE application_id='22222222-2222-4222-8222-222222222222' AND status='submitted'
UNION ALL
SELECT 'reference_requests', COUNT(*)::text FROM cvp_application_reference_requests
WHERE application_id='22222222-2222-4222-8222-222222222222'
UNION ALL
SELECT 'references_received', COUNT(*)::text FROM cvp_application_references
WHERE application_id='22222222-2222-4222-8222-222222222222' AND status='received'
UNION ALL
SELECT 'references_with_ai_analysis', COUNT(*)::text FROM cvp_application_references
WHERE application_id='22222222-2222-4222-8222-222222222222' AND ai_analysis IS NOT NULL
UNION ALL
SELECT 'vendor_created', (CASE WHEN EXISTS (SELECT 1 FROM vendors WHERE id='c9893540-438e-4901-830e-a183b7a16dd5') THEN 'yes' ELSE 'no' END);
