-- Surface why cvp-send-tests couldn't send. Until now the function logged
-- silently to console.error and combos stayed in `pending`, so staff had
-- no signal that anything went wrong (e.g. TM_API_KEY missing in
-- production). Now we capture the reason on the combo row so the admin
-- panel can show "Test couldn't be sent: <reason>" next to each.
ALTER TABLE cvp_test_combinations
  ADD COLUMN IF NOT EXISTS failure_reason text;
