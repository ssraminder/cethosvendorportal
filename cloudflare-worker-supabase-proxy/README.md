# Cethos Supabase Proxy (Cloudflare Worker)

Fronts the project's Supabase endpoint through a Cethos-owned domain so
vendors in regions where `lmzoyezvsjgsxveoakdr.supabase.co` is blocked
or throttled (confirmed: China, Egypt) can still use the vendor portal.

## How it works

```
Vendor browser → https://api.cethos.com/...   ← (this Worker)
                  → https://lmzoyezvsjgsxveoakdr.supabase.co/...
```

Transparent proxy. Supabase's gateway + per-function auth still enforces
everything; this just changes the IP space the request lands on.

## Deploy

Prereq: a Cloudflare account with `cethos.com` (or any Cethos-owned domain)
in it, and the `wrangler` CLI installed (`npm install -g wrangler`).

```bash
cd cloudflare-worker-supabase-proxy
wrangler login
wrangler deploy
```

Then in the Cloudflare dashboard:

1. **Workers & Pages → cethos-supabase-proxy → Triggers → Custom Domains**
2. Add custom domain: `api.cethos.com` (or whichever subdomain you want)
3. Wait ~30s for the DNS + SSL cert to propagate

Test the worker is reachable:
```
curl https://api.cethos.com/__proxy_health
# → {"ok":true,"upstream":"lmzoyezvsjgsxveoakdr.supabase.co","cf_colo":"YYZ","country":"CA"}
```

## Point the vendor portal at the proxy

In Netlify environment variables for `vendor.cethos.com`:

```
VITE_SUPABASE_URL=https://api.cethos.com
```

(Replaces the previous `https://lmzoyezvsjgsxveoakdr.supabase.co` value.)

Trigger a redeploy. The vendor portal's auth helpers + Supabase client will
now route through Cloudflare's network → much higher reachability from
restricted regions.

## What this covers

Everything Supabase serves on the project hostname:
- `/functions/v1/*` — edge functions (auth, business logic)
- `/rest/v1/*` — PostgREST (database queries via the Supabase JS client)
- `/auth/v1/*` — GoTrue (Supabase Auth — currently unused by vendors, but the staff portal uses it)
- `/storage/v1/*` — Storage
- `/realtime/v1/*` — Realtime (websockets)

## Cost

Cloudflare Workers free tier: **100,000 requests/day**. A typical vendor
session is 20–50 requests; comfortably free for any plausible vendor
count. If you ever exceed it, the Paid plan is \$5/mo for 10M requests.

## Limitations

- Adds ~30–50ms of latency depending on which Cloudflare data center the
  user is closer to (often *negative* — i.e., faster — for users far
  from Supabase's home region).
- Doesn't bypass blocks at the user's own ISP that target Cethos's
  domain. If a country blocks `cethos.com`, only a VPN will help.
- WebSocket connections (used by Realtime) are proxied via standard
  upgrade — should work but worth testing if you rely on Realtime.

## Security

- Transparent proxy, no auth check of its own
- Strips CF-specific headers to avoid leaking proxy identity
- Forwards `cf-connecting-ip` as `x-forwarded-for` so Supabase audit
  trails still capture the real client IP
- Permissive CORS (`*`) because the vendor portal runs on multiple
  Netlify preview URLs. Tighten in the worker code if you want to lock
  it down to specific origins.

## Alternative: Supabase Custom Domains (Pro feature)

Supabase Pro ($25/mo) supports custom domains natively — sets up
`api.cethos.com` → your project without needing this worker. Simpler
operationally; just a different cost model.
