/**
 * Netlify Function: get-purchase-orders
 *
 * Same-origin proxy for the `vendor-get-purchase-orders` Supabase Edge
 * Function. The Purchase Orders page previously hit api.cethos.com
 * directly with an Authorization header (preflight-triggering), which
 * fails silently for vendors on networks that geo-block or filter that
 * host — leaving them unable to see their POs or raise an invoice.
 *
 * POST /sb/get-purchase-orders
 * Headers: Authorization: Bearer <session_token>
 * Body: {} (JSON)
 */

import { makeEdgeProxy } from "./_lib/edge-proxy.js";

export const handler = makeEdgeProxy("vendor-get-purchase-orders");
