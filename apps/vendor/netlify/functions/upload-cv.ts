/**
 * Netlify Function: upload-cv
 *
 * Same-origin proxy for the `vendor-upload-cv` Supabase Edge Function.
 * The frontend previously hit api.cethos.com/functions/v1/vendor-upload-cv
 * directly; that surface is geo-blocked in some regions (confirmed:
 * Pakistan/Asia). Routing the upload through this Lambda lets the user's
 * browser talk only to vendor.cethos.com (Netlify, never geo-blocked) and
 * the Lambda's outbound call to api.cethos.com from AWS goes through
 * a path that's never been blocked.
 *
 * POST /sb/upload-cv
 * Headers: Authorization: Bearer <session_token>
 * Body: multipart/form-data with fields { cv, source_docx?, notes? }
 *
 * The Lambda preserves the Authorization header, Content-Type (incl.
 * the multipart boundary), and the raw body bytes, then returns the
 * upstream response verbatim.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const UPSTREAM = `${SUPABASE_URL}/functions/v1/vendor-upload-cv`;

export const handler = async (event: {
  httpMethod?: string;
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<{
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  isBase64Encoded?: boolean;
}> => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, body: "", headers: cors };
  }

  if (!SUPABASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SUPABASE_URL not configured" }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }

  const auth =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";
  const contentType =
    event.headers?.["content-type"] ||
    event.headers?.["Content-Type"] ||
    "application/octet-stream";

  // Multipart uploads arrive base64-encoded; pass the raw bytes through
  // so the boundary and binary file payload remain intact.
  const bodyBuf =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64")
      : event.body
        ? Buffer.from(event.body, "utf-8")
        : Buffer.alloc(0);

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        ...(auth ? { Authorization: auth } : {}),
        "Content-Type": contentType,
      },
      body: bodyBuf,
    });

    const upstreamBody = await upstream.arrayBuffer();
    const upstreamContentType =
      upstream.headers.get("content-type") || "application/json";

    return {
      statusCode: upstream.status,
      body: Buffer.from(upstreamBody).toString("base64"),
      isBase64Encoded: true,
      headers: { "Content-Type": upstreamContentType, ...cors },
    };
  } catch (e) {
    console.error("upload-cv proxy error:", e);
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: "Upstream upload failed",
        detail: e instanceof Error ? e.message : String(e),
      }),
      headers: { "Content-Type": "application/json", ...cors },
    };
  }
};
