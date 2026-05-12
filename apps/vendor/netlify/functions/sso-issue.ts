/**
 * Netlify Function: sso-issue
 *
 * Mints a short-lived (5 min) JWT that hands the current vendor user
 * into another Cethos portal. Phase 1 only supports `target=tm`; the
 * audience and base URL for new targets get added below as we federate
 * more portals.
 *
 * POST /sb/sso-issue
 * Body:
 *   {
 *     session_token?: string,        // legacy — cookie auth preferred
 *     target: "tm",                  // which portal to hand into
 *     job_external_ref?: string      // optional deep-link
 *   }
 * Returns:
 *   { sso_url: "https://tm.cethos.com/sso?token=<jwt>&job=<ref>" }
 *
 * The frontend is expected to set `window.location.href = sso_url`
 * (full-page navigation) so the receiving portal can set its session
 * cookie on `.cethos.com`.
 */

import { query } from "./_lib/db";
import {
  err,
  json,
  jsonWithCookies,
  parseBody,
  type NetlifyResponse,
} from "./_lib/response";
import { requireSession } from "./_lib/session";
import { buildSessionCookie } from "./_lib/cookies";
import { signSsoToken } from "./_lib/jwt";

interface VendorRow {
  id: string;
  email: string;
  full_name: string | null;
  vendor_type: string | null;
}

const TARGETS: Record<string, { audience: string; baseUrl: string }> = {
  tm: {
    audience: "cethos-tm",
    baseUrl: "https://tm.cethos.com/sso",
  },
};

export const handler = async (event: {
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = (parseBody(event.body, event.isBase64Encoded) ?? {}) as {
      session_token?: string;
      target?: string;
      job_external_ref?: string;
    };

    const auth = await requireSession(body, event.headers);
    if ("statusCode" in auth) return auth;

    const target = TARGETS[body.target ?? ""];
    if (!target) {
      return err(
        `unknown SSO target — supported: ${Object.keys(TARGETS).join(", ")}`,
        400,
      );
    }

    const vendors = await query<VendorRow>(
      `SELECT id, email, full_name, vendor_type
         FROM vendors
        WHERE id = $1
        LIMIT 1`,
      [auth.vendor_id],
    );
    const vendor = vendors[0];
    if (!vendor) return err("vendor not found", 404);

    const role: "translator" | "reviewer" =
      vendor.vendor_type === "reviewer" ? "reviewer" : "translator";

    const token = await signSsoToken(
      {
        vendor_user_id: vendor.id,
        email: vendor.email,
        full_name: vendor.full_name ?? undefined,
        role,
        job_external_ref: body.job_external_ref?.trim() || undefined,
      },
      target.audience,
    );

    const params = new URLSearchParams({ token });
    if (body.job_external_ref) {
      params.set("job", body.job_external_ref.trim());
    }
    const sso_url = `${target.baseUrl}?${params.toString()}`;

    const payload = { sso_url };

    // If session rotation fired (cookie auth + 24h elapsed), pass the
    // new cookie back so the browser keeps an active vendor session
    // alongside the SSO redirect.
    if (auth.rotated) {
      return jsonWithCookies(payload, [buildSessionCookie(auth.rotated)]);
    }
    return json(payload);
  } catch (e) {
    console.error("sso-issue error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
