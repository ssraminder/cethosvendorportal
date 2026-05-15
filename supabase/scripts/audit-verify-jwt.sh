#!/usr/bin/env bash
#
# audit-verify-jwt.sh
# Detect edge functions deployed with verify_jwt=true that the vendor
# portal needs to call with a session-UUID (not a JWT). Such functions
# return 401 UNAUTHORIZED_INVALID_JWT_FORMAT from the gateway BEFORE the
# function body runs, breaking the vendor-portal /sb/* flow.
#
# Project convention (per memory: 2026-05-11 — Edge-function deployment):
#   - Every vendor-portal-facing function MUST be deployed with
#     --no-verify-jwt and validate the session UUID internally against
#     vendor_sessions.
#   - Staff-only functions (cvp-staff-reply, cvp-approve-application,
#     etc.) MAY use verify_jwt=true because supabase.functions.invoke
#     from the admin UI sends a valid Supabase auth JWT.
#
# Why this script exists:
#   On 2026-05-15 a vendor reported "load failed (api.cethos.com)" on
#   document upload. Root cause: 7 vendor-* functions had been
#   redeployed via the Supabase MCP / Dashboard without the
#   --no-verify-jwt flag (defaults to verify_jwt=true). The Supabase
#   gateway started rejecting vendor session UUIDs at the edge,
#   producing UNAUTHORIZED_NO_AUTH_HEADER / UNAUTHORIZED_INVALID_JWT
#   errors. Run this script as a pre-deploy / CI check so it can't
#   regress silently.
#
# Usage:
#   ./supabase/scripts/audit-verify-jwt.sh
#
# Exit 0 if every listed function is reachable past the gateway with
# no auth header. Exit 1 if any function returns a gateway-level
# UNAUTHORIZED_* response — meaning verify_jwt=true is on and the
# vendor portal cannot reach it.

set -euo pipefail

BASE="${VENDOR_FUNCTIONS_BASE:-https://api.cethos.com/functions/v1}"

# Functions that MUST be --no-verify-jwt. Browser/JS callers either
# send a vendor session UUID, a request_token, or nothing at all —
# never a valid Supabase JWT. Keep this list in sync with the actual
# code paths in apps/vendor/src/api/ and any /sb/* redirects.
FNS=(
  # Session-token authed (vendor portal post-login)
  vendor-list-cvs
  vendor-upload-cv
  vendor-upload-certification
  vendor-list-doc-requests
  vendor-submit-bug-report
  vendor-verify-phone

  # Token-gated public (ISO evidence flow + reference attestation)
  vendor-resolve-doc-request
  vendor-iso-evidence-complete-item
  vendor-iso-evidence-explain-item
  vendor-iso-quiz-get
  vendor-iso-quiz-submit
  vendor-submit-reference-feedback

  # cvp-* anon-callable (applicant flow)
  cvp-get-my-domains
)

GATEWAY_401_PATTERN='UNAUTHORIZED_NO_AUTH_HEADER|UNAUTHORIZED_INVALID_JWT_FORMAT|UNAUTHORIZED_INVALID_JWT'

fail=0
for fn in "${FNS[@]}"; do
  body=$(curl -sS -X POST "$BASE/$fn" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "")
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE/$fn" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
  if echo "$body" | grep -qE "$GATEWAY_401_PATTERN"; then
    printf "  ❌ %-40s HTTP=%s  GATEWAY-401 (verify_jwt=true). Redeploy with --no-verify-jwt.\n" "$fn" "$code"
    fail=$((fail + 1))
  else
    printf "  ✅ %-40s HTTP=%s  (function-level response)\n" "$fn" "$code"
  fi
done

echo
if [ "$fail" -gt 0 ]; then
  printf "FAILED: %d function(s) have verify_jwt=true set incorrectly. Run:\n" "$fail"
  printf "  supabase functions deploy <name> --no-verify-jwt --project-ref lmzoyezvsjgsxveoakdr\n"
  exit 1
fi
echo "OK — every vendor-facing function is reachable past the gateway."
