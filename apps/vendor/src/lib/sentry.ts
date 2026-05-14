import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN || "";

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
  beforeSend(event) {
    const exception = event.exception?.values?.[0];
    if (exception?.type === "AbortError") return null;
    if (exception?.value?.includes("AbortError")) return null;
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
