/**
 * Netlify Function: list-devices
 * Lists the vendor's active "remembered" browsers (trusted devices) for the
 * Settings → Devices screen.
 *
 * POST /sb/list-devices
 * Body: { session_token?: string }
 * Returns: { devices: [{ id, label, user_agent, created_at, last_seen_at, expires_at, current }] }
 */

import { requireSession } from "./_lib/session";
import { json, jsonWithCookies, parseBody, type NetlifyResponse } from "./_lib/response";
import { buildSessionCookie, readTrustTokenFromRequest } from "./_lib/cookies";
import { listTrustedDevices } from "./_lib/trusted-device";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as { session_token?: string };
    const auth = await requireSession(body, event.headers);
    if ("statusCode" in auth) return auth;

    const trustToken = readTrustTokenFromRequest(event.headers);
    const devices = await listTrustedDevices(auth.vendor_id, trustToken);

    if ("rotated" in auth && auth.rotated) {
      return jsonWithCookies({ devices }, [buildSessionCookie(auth.rotated)]);
    }
    return json({ devices });
  } catch (e) {
    console.error("list-devices error:", e);
    return json({ devices: [], error: "Internal server error" }, 500);
  }
};
