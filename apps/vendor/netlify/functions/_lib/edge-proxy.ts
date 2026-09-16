/**
 * Shared same-origin passthrough proxy for Supabase Edge Functions.
 *
 * Same rationale as upload-cv.ts / list-cvs.ts: direct browser calls to
 * api.cethos.com are geo-blocked or preflight-filtered in some regions
 * (Pakistan confirmed 2026-05-16; others reported since). Routing through
 * a Netlify Lambda keeps the vendor's browser on vendor.cethos.com only —
 * the Lambda's outbound call to api.cethos.com from AWS is never blocked.
 *
 * Preserves the Authorization header, Content-Type (incl. any multipart
 * boundary), and raw body bytes, and returns the upstream response
 * verbatim (base64 so binary payloads survive).
 */

export interface ProxyEvent {
  httpMethod?: string;
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}

export interface ProxyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  isBase64Encoded?: boolean;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function makeEdgeProxy(functionName: string) {
  return async (event: ProxyEvent): Promise<ProxyResponse> => {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, body: "", headers: CORS };
    }

    const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
    if (!SUPABASE_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "SUPABASE_URL not configured" }),
        headers: { "Content-Type": "application/json", ...CORS },
      };
    }

    const auth = event.headers?.authorization || event.headers?.Authorization || "";
    const contentType =
      event.headers?.["content-type"] ||
      event.headers?.["Content-Type"] ||
      "application/json";

    // Multipart uploads arrive base64-encoded; pass the raw bytes through
    // so the boundary and binary file payload remain intact.
    const bodyBuf =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64")
        : event.body
          ? Buffer.from(event.body, "utf-8")
          : Buffer.alloc(0);

    try {
      const upstream = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          ...(auth ? { Authorization: auth } : {}),
          "Content-Type": contentType,
        },
        body: bodyBuf,
      });

      const upstreamBody = await upstream.arrayBuffer();
      const upstreamContentType = upstream.headers.get("content-type") || "application/json";

      return {
        statusCode: upstream.status,
        body: Buffer.from(upstreamBody).toString("base64"),
        isBase64Encoded: true,
        headers: { "Content-Type": upstreamContentType, ...CORS },
      };
    } catch (e) {
      console.error(`${functionName} proxy error:`, e);
      return {
        statusCode: 502,
        body: JSON.stringify({
          success: false,
          error: "Upstream request failed",
          detail: e instanceof Error ? e.message : String(e),
        }),
        headers: { "Content-Type": "application/json", ...CORS },
      };
    }
  };
}
