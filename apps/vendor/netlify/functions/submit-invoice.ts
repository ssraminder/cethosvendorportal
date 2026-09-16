/**
 * Netlify Function: submit-invoice
 *
 * Same-origin proxy for the `vendor-submit-invoice` Supabase Edge
 * Function (vendor submits a draft invoice, optionally with a file).
 * Same geo-block rationale as the other /sb/* endpoints.
 *
 * POST /sb/submit-invoice
 * Headers: Authorization: Bearer <session_token>
 * Body: multipart/form-data { invoice_id, vendor_invoice_number, file? }
 */

import { makeEdgeProxy } from "./_lib/edge-proxy";

export const handler = makeEdgeProxy("vendor-submit-invoice");
