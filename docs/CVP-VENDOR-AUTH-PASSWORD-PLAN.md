# CVP — Vendor Password Login + "Remember this browser" (Trusted Devices)

**Document:** `CVP-VENDOR-AUTH-PASSWORD-PLAN.md`
**Status:** **Phases 1–3 complete** (backend + frontend, v2026.7.18) 2026-07-16 — in the working tree, typecheck/build/lint green, not yet committed/pushed. Verify on a Netlify deploy preview (localhost can't route to the `/sb` functions). Phase 4 = rollout. Trusted-device table = `vendor_trusted_devices`.
**Owner:** Raminder
**Related:** `apps/vendor/netlify/functions/auth-*`, `_lib/cookies.ts`, `_lib/session.ts`, `vendor_auth` / `vendor_sessions` / `vendor_otp`

---

## 1. Goal

Add an optional **password** as the everyday login factor and a **"Remember this browser"** trusted-device mechanism so a vendor is only asked for an OTP on a new browser or after a configurable window (default **30 days**, tunable 30–45). Email stays the account identifier; OTP (email/SMS) becomes periodic step-up MFA rather than an every-login gate.

### Approved decisions
- **Model:** Password + periodic OTP. Everyday login = email + password; OTP only on a new/expired browser. "Remember this browser" skips OTP within the window. **Remember-browser requires a password** — a device cookie alone can never log in.
- **Rollout:** Opt-in. Vendors without a password keep today's OTP-every-login flow. Show a **non-blocking reminder** to set up a password.
- **Cadence:** Configurable via env `TRUSTED_DEVICE_DAYS` (default **30**).

---

## 2. Current state (what already exists)

| Piece | Status |
|---|---|
| `vendor_auth` (password) | ✅ `password_hash`, `password_set_at`, `must_reset`, `password_setup_token`, `password_setup_expires_at` |
| Password login / set | ✅ `vendor-auth-password` (bcryptjs `compare`, cost 10) + `vendor-set-password` (bcrypt cost 10) — **Supabase edge only, not `/sb` Netlify** |
| `auth-check` | ✅ already returns `{ exists, has_phone, has_password, is_first_login }` |
| Sessions | ✅ `vendor_sessions` with `revoked_at`, `rotated_from`, `user_agent`, `origin`, `last_seen_at`; HttpOnly `cethos_session_vendor` cookie, `Domain=.cethos.com`, 30-day |
| Login UI password path | ❌ removed from `LoginPage.tsx` |
| Trusted devices | ❌ none (only unrelated `kiosk_devices`) |
| Password on `/sb` Netlify path | ❌ not ported → blocked in China/MENA regions |

**Implication:** roughly half the backend exists. The net-new work is region-safe porting, the trusted-device layer, and the UI.

---

## 3. Target flow

```
Enter email  ── auth-check ──►
   ├─ has_password = false ──► OTP-only (today's flow, unchanged) + "Set a password?" reminder after login
   └─ has_password = true  ──► Enter password  ── auth-password ──►
         ├─ trusted-device cookie valid (≤ TRUSTED_DEVICE_DAYS) ──► signed in, no OTP
         └─ not trusted / expired ──► { needs_otp: true }
                └─ OTP step-up (email/SMS)  ── auth-otp-verify (remember_device?) ──►
                       └─ if "Remember this browser" ✓ → issue device token → signed in
```

Key invariant: **the trusted-device cookie only lets the user skip the OTP step; the password is always required.** A stolen device cookie without the password is useless.

---

## 4. Data model

### New table (migration)
```sql
create table vendor_trusted_devices (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references vendors(id) on delete cascade,
  token_hash    text not null,             -- SHA-256 of the raw cookie token (never store raw)
  user_agent    text,                      -- advisory, for the device list + soft check
  label         text,                      -- e.g. "Chrome on Windows" (derived) or user-set
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,      -- now() + TRUSTED_DEVICE_DAYS
  revoked_at    timestamptz,
  rotated_from  text                        -- prior token_hash on rotation (theft forensics)
);
create index on vendor_trusted_devices (vendor_id) where revoked_at is null;
create unique index on vendor_trusted_devices (token_hash);
```
> **Open decision (naming):** CLAUDE.md mandates a `cvp_` prefix for new tables, but the sibling auth tables are unprefixed (`vendor_auth`, `vendor_otp`, `vendor_sessions`). Recommend `vendor_trusted_devices` for cohesion with the auth family; confirm before the migration.

### Reuse
- `vendor_auth` as-is (bcrypt hash). **Bump cost 10 → 12** on next set/reset (transparent; old hashes still verify).
- `vendor_sessions` unchanged (issued after either password-trusted or password+OTP success).

---

## 5. Endpoints (all on the `/sb` Netlify path for region safety)

| Function | Purpose | Notes |
|---|---|---|
| `auth-check` | already returns `has_password` | no change (frontend branches on it) |
| `auth-password` *(new /sb port)* | verify email+password; check trusted-device cookie → return session **or** `{ needs_otp: true }` | bcrypt 12; lockout + rate-limit; audit |
| `set-password` *(new /sb port)* | set/change password (requires valid session) | bcrypt 12; policy; **revokes all trusted devices** on change |
| `auth-otp-verify` *(extend)* | accept `remember_device: boolean`; on success + true → create `vendor_trusted_devices` row + set trust cookie | reuses existing OTP verify |
| `auth-forgot-password` | flow: send OTP → verify → land on set-password | reuses OTP send/verify; no new secret channel |
| `list-devices` / `revoke-device` *(new)* | Settings → "Devices": list active trusted devices, revoke one/all | auth-gated |

### New cookie (`_lib/cookies.ts`)
`cethos_trust_vendor` — raw token; **HttpOnly, Secure, SameSite=Lax, Domain=.cethos.com, Path=/, Max-Age = TRUSTED_DEVICE_DAYS**. DB stores only `sha256(token)`. **Rotate on each successful trusted login** (issue new token, set `rotated_from`, revoke old) to shrink the theft window. Trust cookie persists across logout (logout clears only the session cookie).

---

## 6. Security controls (the "how safe" checklist)

- **Password:** bcrypt **cost 12**; store hash only; policy = min length 10, block top-common/breached (optional HIBP k-anonymity), never log.
- **Trusted token:** 256-bit CSPRNG; **stored hashed** (SHA-256) at rest; HttpOnly (no JS), Secure, SameSite=Lax; rotate-on-use; per-device + global revoke; **auto-revoke all on password change**.
- **Skip is OTP-only:** trusted cookie never bypasses the password — the core safety property.
- **Brute force:** reuse OTP-layer lockout (`OTP_MAX_ATTEMPTS` / `OTP_LOCKOUT_MINUTES`); add password-attempt lockout keyed on vendor + IP.
- **Shared computers:** "Remember this browser" **off by default**, labeled *"Only check this on your personal device."*
- **UA binding:** advisory (store + log mismatch); do not hard-fail (breaks on browser updates).
- **Session hardening (bonus):** consider hashing `vendor_sessions.session_token` + trust tokens at rest so a DB leak isn't directly replayable.
- **Audit (audit-facing per CLAUDE.md):** log password set/reset, OTP issue/verify, device trust/rotate/revoke, login success/fail with `origin`.

### Residual risks & handling
- *Shared/public computer* → opt-in + labeling + revoke list.
- *Cookie theft via XSS* → HttpOnly + short TTL + rotation + visible device list.
- *Lost device* → self-serve revoke in Settings; staff force-logout.

---

## 7. Frontend (`apps/vendor`)

- **`LoginPage.tsx`** → small state machine: `email → (password | otp) → [otp step-up] → done`.
  - After email, branch on `has_password`.
  - Password screen: password field, "Forgot password?", link to OTP fallback ("Email/Text me a code instead").
  - On `needs_otp`, go to the existing OTP step (already supports email/SMS) with a **"Remember this browser"** checkbox (off by default) → passes `remember_device` to verify.
- **Set / Forgot password screens** (reuse `set-password`).
- **Settings → "Devices"**: list trusted browsers (label, last seen, expiry) + "Sign out" per device / "Sign out everywhere."
- **Reminder to set a password:** non-blocking banner/modal after OTP login for vendors with `has_password = false` ("Add a password so you're not asked for a code every time"). Dismissible; re-surface on a cooldown.
- **Release note + version bump** (`releaseNotes.ts`) and admin `portalRegistry.ts` per repo rules.

---

## 8. Phases & estimate (~1.5–2 dev-days for v1)

1. **Password on `/sb` (region-safe)** — port `auth-password` + `set-password` to Netlify (`_lib` bcrypt), cost 12, policy, lockout, audit; forgot-password via OTP. *(~0.5d)*
2. **Trusted devices** — migration; issue on OTP verify (`remember_device`); `auth-password` trust-check → skip/step-up; rotation; list/revoke; auto-revoke on password change. *(~0.5d)*
3. **Frontend** — LoginPage state machine, remember-browser checkbox, set/forgot screens, Settings→Devices, reminder banner, version bump. *(~0.5–0.75d)*
4. **Rollout & verify** — opt-in; reminder; end-to-end tests (new browser, trusted skip, expiry re-prompt, revoke, password change kills devices, blocked-region parity). *(~0.25d)*

---

## 9. Open decisions before build
1. Trusted-device table name: `vendor_trusted_devices` (sibling convention, recommended) vs `cvp_` prefix (CLAUDE.md literal).
2. Password policy strictness (min length / breached-password check on/off).
3. Rotate-on-use for trust tokens (recommended) vs fixed token for the window.
4. Whether to also hash `vendor_sessions.session_token` at rest in the same pass (defense-in-depth, slightly larger blast radius of change).
