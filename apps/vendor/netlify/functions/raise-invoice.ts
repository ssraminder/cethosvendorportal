/**
 * Netlify Function: raise-invoice
 *
 * Same-origin proxy for the `vendor-raise-invoice` Supabase Edge Function
 * (the vendor raises ONE self-billed invoice covering one or more purchase
 * orders; Cethos generates the PDF — nothing is uploaded). Direct
 * api.cethos.com calls fail for vendors on networks that geo-block or filter
 * that host — same rationale as upload-cv.ts.
 *
 * POST /sb/raise-invoice
 * Headers: Authorization: Bearer <session_token>
 * Body: application/json { po_ids: string[], vendor_invoice_number,
 *       invoice_date?, charges_tax?, tax_registration_number?,
 *       accept_self_billing? }
 */

import { makeEdgeProxy } from "./_lib/edge-proxy.js";

export const handler = makeEdgeProxy("vendor-raise-invoice");
