/**
 * Shared response helpers. Always return permissive CORS (the request
 * is already same-origin via /sb redirect, but the * header is harmless).
 */

export interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export function json(payload: unknown, status = 200): NetlifyResponse {
  return {
    statusCode: status,
    body: JSON.stringify(payload),
    headers: baseHeaders,
  };
}

export function err(message: string, status = 500, extra: Record<string, unknown> = {}): NetlifyResponse {
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
