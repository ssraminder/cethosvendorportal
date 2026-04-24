# Mailgun Setup — CVP

All CVP outbound email now routes through **Mailgun EU**. Inbound applicant replies are handled by a Mailgun Route → `cvp-inbound-email` edge function (Phase 1: unsubscribe + AI auto-reply to `vm@cethos.com`).

## 1. Supabase secrets to add

Supabase dashboard → **Edge Functions → Manage secrets**, or CLI:

```bash
supabase secrets set \
  MAILGUN_API_KEY='key-xxxxxxxxxxxx' \
  MAILGUN_DOMAIN='vendors.cethos.com' \
  MAILGUN_REGION='eu' \
  MAILGUN_FROM_EMAIL='noreply@vendors.cethos.com' \
  MAILGUN_FROM_NAME='CETHOS Vendor Portal' \
  MAILGUN_REPLY_TO='recruiting@vendors.cethos.com' \
  MAILGUN_WEBHOOK_SIGNING_KEY='xxxxxxxxxxxxxxxxxxxx' \
  CVP_SUPPORT_EMAIL='vm@cethos.com'
```

| Variable | Where to find it | Notes |
|---|---|---|
| `MAILGUN_API_KEY` | Mailgun → Sending → API keys → **Private API key** | **Not** the public key, **not** the webhook signing key |
| `MAILGUN_DOMAIN` | Mailgun → Sending → Domains | The verified sending domain, e.g. `vendors.cethos.com` |
| `MAILGUN_REGION` | — | `eu` for this project (EU data residency). `us` for US |
| `MAILGUN_FROM_EMAIL` | you choose | The `From:` address. Must be on the verified domain |
| `MAILGUN_FROM_NAME` | you choose | Displayed sender name |
| `MAILGUN_REPLY_TO` | you choose | Set to `recruiting@vendors.cethos.com` — replies land here |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Mailgun → Sending → Webhooks → **HTTP webhook signing key** | Used by `cvp-inbound-email` to verify inbound POSTs |
| `CVP_SUPPORT_EMAIL` | — | Surfaced in auto-replies and the default footer of every template |

**Deprecate** after 1 week of Mailgun in production:
```
BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
```

## 2. DNS for the sending domain (one-time)

Mailgun → Sending → Domains → **Add New Domain** → select **EU**. Mailgun generates records; add them at your DNS provider:

| Type | Host | Value |
|---|---|---|
| TXT | `@` (or subdomain) | `v=spf1 include:mailgun.org ~all` |
| TXT | `mx._domainkey.<subdomain>` | (long base64 from Mailgun) |
| **MX** | `<subdomain>` | `10 mxa.eu.mailgun.org`, `10 mxb.eu.mailgun.org` |
| CNAME (optional) | `email.<subdomain>` | `eu.mailgun.org` |

**MX records are required for inbound.** Without them, Mailgun can't receive email to `recruiting@vendors.cethos.com`. SPF/DKIM propagate in minutes; MX often takes several hours.

Click **Verify** in Mailgun after propagation. All rows should go green.

## 3. Inbound Route (in Mailgun dashboard)

Mailgun → **Receiving → Routes → Create Route**:

1. **Priority:** `10`
2. **Filter Expression:**
   ```
   match_recipient("recruiting@vendors.cethos.com")
   ```
3. **Actions** (both, in this order):
   ```
   forward("https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-inbound-email")
   stop()
   ```
4. **Description:** `CVP inbound recruiting webhook`
5. Click **Create Route**.

`forward()` POSTs parsed multipart/form-data to our edge function. `stop()` prevents default routes from firing a duplicate webhook.

**Do not use `store()`** — that queues for pull; we want direct push.

## 4. Deploy + migrate

```bash
# From repo root
# (a) apply the new migration
supabase db push
# or manually apply supabase/migrations/014_cvp_inbound_emails.sql

# (b) deploy the new edge function
supabase functions deploy cvp-inbound-email --no-verify-jwt

# (c) redeploy every edge function that sends email (Brevo → Mailgun swap)
for fn in cvp-submit-application cvp-prescreen-application cvp-send-tests \
          cvp-submit-test cvp-check-test-followups cvp-approve-application \
          cvp-send-queued-rejections cvp-request-info cvp-daily-recruitment-status \
          vendor-auth-otp-send vendor-auth-invite \
          notify-vendor-job-offer notify-vendor-job-approved notify-vendor-deadline-reminder; do
  supabase functions deploy "$fn"
done
```

## 5. Smoke test (before flipping DNS / cutting users over)

1. **Send** — call the daily-status function manually; confirm email delivers:
   ```bash
   curl -X POST "$SUPABASE_URL/functions/v1/cvp-daily-recruitment-status"
   ```
2. **Inbound signature** — in Mailgun → Routes → your route → **Test Route**. Our logs should show `signature_ok` and a row in `cvp_inbound_emails`.
3. **Inbound unsubscribe** — send a real email from a personal account with body "please unsubscribe" to `recruiting@vendors.cethos.com`. Expect:
   - `cvp_inbound_emails` row with `classified_intent='unsubscribe'`, `action_taken='do_not_contact_set'`
   - `cvp_applications.do_not_contact=true` for that email (if a matching application exists)
   - Confirmation reply in your inbox
4. **Inbound other** — send "quick question on my status". Expect AI auto-reply pointing to `vm@cethos.com` in the same language as the inbound message.
5. **Outbound gate** — trigger any template (e.g. V17 request-info) to a `do_not_contact=true` applicant; confirm `emailSent=false, suppressed=true` in the response and no delivery in Mailgun logs.

## 6. Common gotchas

- **No inbound webhook fires.** MX not verified yet. Check Mailgun → Sending → Domains for red rows.
- **401 Invalid signature.** Using wrong key. The webhook signing key is under **Webhooks**, not the API key.
- **Duplicate webhooks.** You forgot `stop()` or there's another route matching the same recipient. Delete the other route or add `stop()`.
- **Email goes to spam.** SPF passes but DKIM not verified. Re-check the DKIM TXT record is present and the value matches exactly (no line breaks).
- **Region mismatch.** US-region accounts use `mxa.mailgun.org`. We're on EU — use `eu.mailgun.org`. Setting `MAILGUN_REGION=eu` in secrets **and** using EU MX records are both required.

## 7. Future phases (see full plan)

- **Phase 2:** intent taxonomy (status inquiry, counter-offer, appeal) + per-intent auto-replies and staff routing.
- **Phase 3:** thread tracking via Message-Id / In-Reply-To; admin inbox tab on `/admin/recruitment/:id`.
- **Phase 4:** AI first-draft replies that staff approve before sending; per-intent response-time metrics.
