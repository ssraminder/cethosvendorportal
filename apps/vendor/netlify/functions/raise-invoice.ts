/**
 * Netlify Function: raise-invoice
 *
 * Same-origin proxy for the `vendor-raise-invoice` Supabase Edge Function
 * (vendor raises an invoice against a sent PO; multipart with a mandatory
 * invoice document). Direct api.cethos.com uploads fail for vendors on
 * networks that geo-block or filter that host — same rationale as
 * upload-cv.ts. Note Lambda payload limit (~6 MB base64) is below the
 * edge function's 20 MB cap; the client falls back to the direct edge
 * call on 413.
 *
 * POST /sb/raise-invoice
 * Headers: Authorization: Bearer <session_token>
 * Body: multipart/form-data { po_id, vendor_invoice_number, apply_gst, file }
 */

import { makeEdgeProxy } from "./_lib/edge-proxy";

export const handler = makeEdgeProxy("vendor-raise-invoice");
