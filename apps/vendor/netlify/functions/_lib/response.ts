/**
 * Shared response helpers. Always return permissive CORS (the request
 * is already same-origin via /sb redirect, but the * header is harmless
 * for body-only auth — for cookie-based auth we reflect the origin
 * explicitly because credentials and `*` are incompatible per spec).
 *
 * The 3rd `extraHeaders` parameter on `json()` lets call sites attach
 * Set-Cookie, custom Cache-Control, etc. without losing the base
 * Content-Type / CORS headers.
 */

export interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  // Netlify-specific: when you need to send multiple Set-Cookie headers
  // (rotation: clear old, set new), use this array.
  multiValueHeaders?: Record<string, string[]>;
}

const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export function json(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): NetlifyResponse {
  return {
    statusCode: status,
    body: JSON.stringify(payload),
    headers: { ...baseHeaders, ...extraHeaders },
  };
}

/**
 * Variant for when you need to send multiple Set-Cookie headers (e.g.
 * clear an old cookie + set a new one in a single response). Netlify
 * expects this via `multiValueHeaders`, NOT a single comma-joined
 * `headers["Set-Cookie"]` (browsers parse that wrong for HttpOnly).
 */
export function jsonWithCookies(
  payload: unknown,
  cookies: string[],
  status = 200,
): NetlifyResponse {
  return {
    statusCode: status,
    body: JSON.stringify(payload),
    headers: baseHeaders,
    multiValueHeaders: {
      "Set-Cookie": cookies,
    },
  };
}

export function err(
  message: string,
  status = 500,
  extra: Record<string, unknown> = {},
): NetlifyResponse {
  return json({ error: message, ...extra }, status);
}

export function parseBody(eventBody: string | null, isBase64?: boolean): unknown {
  if (!eventBody) return {};
  const raw = isBase64 ? Buffer.from(eventBody, "base64").toString("utf-8") : eventBody;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
