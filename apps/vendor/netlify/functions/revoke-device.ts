/**
 * Netlify Function: revoke-device
 * Revokes a single remembered browser, or all of them ("sign out everywhere").
 * Revoking a device forces OTP step-up again on that browser at the next
 * password login.
 *
 * POST /sb/revoke-device
 * Body: { session_token?: string, device_id?: string, all?: boolean }
 * Returns: { success: true }
 */

import { requireSession } from "./_lib/session";
import { json, jsonWithCookies, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { buildSessionCookie } from "./_lib/cookies";
import { revokeTrustedDevice, revokeAllTrustedDevices } from "./_lib/trusted-device";

interface Body {
  session_token?: string;
  device_id?: string;
  all?: boolean;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as Body;
    const auth = await requireSession(body, event.headers);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    if (body.all === true) {
      await revokeAllTrustedDevices(vendor_id);
    } else {
      const deviceId = (body.device_id ?? "").trim();
      if (!deviceId) return err("device_id or all is required", 400);
      const hit = await revokeTrustedDevice(vendor_id, deviceId);
      if (!hit) return err("Device not found", 404);
    }

    if ("rotated" in auth && auth.rotated) {
      return jsonWithCookies({ success: true }, [buildSessionCookie(auth.rotated)]);
    }
    return json({ success: true });
  } catch (e) {
    console.error("revoke-device error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
