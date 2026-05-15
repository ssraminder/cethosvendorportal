import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN || "";

// Query-string keys that may carry a session token, OTP, signed-URL
// signature, doc-request token, or password-reset token. We strip them
// from breadcrumb URLs + the event request URL before shipping to Sentry.
// Audit finding M-5.
const SENSITIVE_QS_KEYS = new Set([
  "token",
  "session_token",
  "sessionToken",
  "otp",
  "otp_code",
  "code",
  "password",
  "secret",
  "signature",
  "Signature",
  "sig",
  "key",
  "applicationId", // CV-URL guessable UUID — keep off the wire
]);

// Body field names to redact if we see them inside breadcrumb fetch
// payloads (Sentry's fetch integration captures request body by default).
const SENSITIVE_BODY_KEYS = new Set([
  "password",
  "new_password",
  "current_password",
  "otp_code",
  "token",
  "session_token",
  "payment_details",
  "credit_card",
  "card_number",
  "cvv",
]);

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    let mutated = false;
    for (const k of Array.from(u.searchParams.keys())) {
      if (SENSITIVE_QS_KEYS.has(k)) {
        u.searchParams.set(k, "[REDACTED]");
        mutated = true;
      }
    }
    return mutated ? u.toString() : url;
  } catch {
    return url;
  }
}

function redactBody(value: unknown): unknown {
  if (typeof value === "string") {
    // Try JSON parse; if successful, redact + reserialize. Otherwise
    // leave alone (free-text bodies are unlikely to carry secrets).
    try {
      const parsed = JSON.parse(value);
      const redacted = redactBody(parsed);
      return JSON.stringify(redacted);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(redactBody);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_KEYS.has(k) ? "[REDACTED]" : redactBody(v);
    }
    return out;
  }
  return value;
}

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Strip tokens / passwords / OTP codes from URLs and request bodies
  // before they leave the browser. Audit finding M-5.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data && typeof breadcrumb.data === "object") {
      const data = breadcrumb.data as Record<string, unknown>;
      if (typeof data.url === "string") {
        data.url = redactUrl(data.url);
      }
      if ("body" in data) {
        data.body = redactBody(data.body);
      }
      if ("request_body_size" in data) {
        // size is fine; just ensure we don't accidentally leak a
        // stringified body via the wrong field
      }
      if ("response" in data) {
        data.response = redactBody(data.response);
      }
    }
    if (typeof breadcrumb.message === "string") {
      breadcrumb.message = redactUrl(breadcrumb.message);
    }
    return breadcrumb;
  },

  beforeSend(event) {
    const exception = event.exception?.values?.[0];
    if (exception?.type === "AbortError") return null;
    if (exception?.value?.includes("AbortError")) return null;

    // Redact sensitive query params from the event-level request URL.
    if (event.request?.url) {
      event.request.url = redactUrl(event.request.url);
    }
    // And from any breadcrumbs that slipped through beforeBreadcrumb
    // (defence-in-depth for breadcrumbs added by integrations after our
    // hook).
    if (event.breadcrumbs) {
      for (const b of event.breadcrumbs) {
        if (b.data && typeof b.data === "object") {
          const data = b.data as Record<string, unknown>;
          if (typeof data.url === "string") {
            data.url = redactUrl(data.url);
          }
          if ("body" in data) data.body = redactBody(data.body);
        }
      }
    }
    return event;
  },
});

export function setSentryUser(
  user: { id: string; email?: string; role?: string } | null,
) {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, segment: user.role });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Report an edge-function error to Sentry.
 *
 * `fetch()` doesn't throw on non-2xx, and our call sites typically catch
 * thrown errors into local state — so Sentry never sees either kind by
 * default. This helper makes both visible with one call.
 *
 * Severity routing:
 *   - 5xx, network failures, parse errors, unknown throws → "error"
 *   - 4xx (except routine session_expired)                → "warning"
 *   - session_expired                                     → "info"
 */
export function reportApiError(args: {
  endpoint: string;
  status?: number;
  /** Server-provided error code from the JSON body, if any (e.g. "session_not_found"). */
  code?: string;
  /** Original thrown/caught error, if any. */
  error?: unknown;
  /** Extra context to attach to the event. */
  extra?: Record<string, unknown>;
}) {
  const { endpoint, status, code, error, extra } = args;

  const level: Sentry.SeverityLevel =
    code === "session_expired"
      ? "info"
      : status && status >= 500
        ? "error"
        : status && status >= 400
          ? "warning"
          : "error";

  const tags: Record<string, string> = { endpoint };
  if (typeof status === "number") tags.status = String(status);
  if (code) tags.code = code;

  if (error instanceof Error) {
    Sentry.captureException(error, { level, tags, extra });
    return;
  }
  const summary = status
    ? `${endpoint} ${status}${code ? ` ${code}` : ""}`
    : `${endpoint} ${code ?? "unknown_error"}`;
  Sentry.captureMessage(summary, { level, tags, extra });
}
