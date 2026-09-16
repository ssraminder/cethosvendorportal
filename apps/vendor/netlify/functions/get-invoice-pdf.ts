/**
 * Netlify Function: get-invoice-pdf
 *
 * Same-origin proxy for the `vendor-get-invoice-pdf` Supabase Edge
 * Function (returns a signed URL for an invoice PDF). Same geo-block
 * rationale as the other /sb/* endpoints.
 *
 * POST /sb/get-invoice-pdf
 * Headers: Authorization: Bearer <session_token>
 * Body: { invoice_id } (JSON)
 */

import { makeEdgeProxy } from "./_lib/edge-proxy.js";

export const handler = makeEdgeProxy("vendor-get-invoice-pdf");
