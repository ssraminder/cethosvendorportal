#!/usr/bin/env bash
# ============================================================================
# Brevo Template Uploader
# ============================================================================
# Reads every template in supabase/email-templates/ and creates a matching
# transactional template in Brevo. Prints a JSON map of { id: brevoTemplateId }
# at the end which can be piped into supabase/functions/_shared/brevo.ts.
#
# Usage:
#   BREVO_API_KEY=xkeysib-xxx BREVO_SENDER_NAME="CETHOS" BREVO_SENDER_EMAIL="recruiting@cethos.com" \
#     bash scripts/upload-brevo-templates.sh
#
# Idempotency: Brevo does NOT de-dupe by name — calling this twice creates
# duplicates. Run once. If a template exists and you want to update it,
# delete it in Brevo first, or extend this script to PUT instead of POST.
# ============================================================================

set -euo pipefail

if [[ -z "${BREVO_API_KEY:-}" ]]; then
  echo "Error: BREVO_API_KEY env var is required" >&2
  exit 1
fi

SENDER_NAME="${BREVO_SENDER_NAME:-CETHOS}"
SENDER_EMAIL="${BREVO_SENDER_EMAIL:-recruiting@cethos.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../supabase/email-templates"
MANIFEST="$TEMPLATES_DIR/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: manifest not found at $MANIFEST" >&2
  exit 1
fi

# Need jq for JSON parsing.
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required. Install from https://stedolan.github.io/jq/" >&2
  exit 1
fi

RESULTS="{}"
TEMPLATE_COUNT=$(jq 'length' "$MANIFEST")

echo "Uploading $TEMPLATE_COUNT templates to Brevo (sender: $SENDER_NAME <$SENDER_EMAIL>)..." >&2
echo "" >&2

for i in $(seq 0 $((TEMPLATE_COUNT - 1))); do
  ID=$(jq -r ".[$i].id" "$MANIFEST")
  LABEL=$(jq -r ".[$i].label" "$MANIFEST")
  SUBJECT=$(jq -r ".[$i].subject" "$MANIFEST")
  HTML_PATH=$(jq -r ".[$i].html" "$MANIFEST")
  TXT_PATH=$(jq -r ".[$i].txt" "$MANIFEST")

  HTML_CONTENT=$(cat "$TEMPLATES_DIR/${HTML_PATH#templates/}")
  TXT_CONTENT=""
  if [[ -f "$TEMPLATES_DIR/${TXT_PATH#templates/}" ]]; then
    TXT_CONTENT=$(cat "$TEMPLATES_DIR/${TXT_PATH#templates/}")
  fi

  PAYLOAD=$(jq -n \
    --arg name "$LABEL" \
    --arg subject "$SUBJECT" \
    --arg sender_name "$SENDER_NAME" \
    --arg sender_email "$SENDER_EMAIL" \
    --arg html "$HTML_CONTENT" \
    --arg txt "$TXT_CONTENT" \
    '{
      templateName: $name,
      subject: $subject,
      sender: { name: $sender_name, email: $sender_email },
      htmlContent: $html,
      isActive: true
    } + (if $txt != "" then { replyTo: $sender_email } else {} end)')

  printf "  [%2d/%d] %s ... " "$((i + 1))" "$TEMPLATE_COUNT" "$LABEL" >&2

  RESPONSE=$(curl -sS -w "\n__HTTP_STATUS__%{http_code}" \
    -X POST "https://api.brevo.com/v3/smtp/templates" \
    -H "api-key: $BREVO_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD") || {
      echo "FAILED (curl error)" >&2
      continue
    }

  HTTP_STATUS=$(echo "$RESPONSE" | grep -oE '__HTTP_STATUS__[0-9]+$' | sed 's/__HTTP_STATUS__//')
  BODY=$(echo "$RESPONSE" | sed -E 's/__HTTP_STATUS__[0-9]+$//')

  if [[ "$HTTP_STATUS" != "201" && "$HTTP_STATUS" != "200" ]]; then
    echo "FAILED ($HTTP_STATUS): $BODY" >&2
    continue
  fi

  BREVO_ID=$(echo "$BODY" | jq -r '.id')
  echo "id=$BREVO_ID" >&2

  RESULTS=$(echo "$RESULTS" | jq --arg k "$ID" --argjson v "$BREVO_ID" '. + { ($k): $v }')
done

echo "" >&2
echo "Done. Template ID map:" >&2
echo "$RESULTS" | jq .
