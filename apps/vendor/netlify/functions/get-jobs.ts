/**
 * Netlify Function: get-jobs
 * Port of vendor-get-jobs Supabase function. Direct Postgres queries.
 *
 * POST /sb/get-jobs
 * Body: { session_token: string, tab: "offered" | "active" | "completed" }
 * Returns: { success, jobs, counts: { offered, active, completed } }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveLanguageCodes(uuids: string[]): Promise<Map<string, string>> {
  if (uuids.length === 0) return new Map();
  const rows = await query<{ id: string; code: string }>(
    `SELECT id, code FROM languages WHERE id = ANY($1::uuid[])`,
    [uuids],
  );
  return new Map(rows.map((r) => [r.id, r.code.toUpperCase()]));
}

function resolveLang(val: string | null, codeMap: Map<string, string>): string | null {
  if (!val) return null;
  if (UUID_RE.test(val)) return codeMap.get(val) ?? val;
  return val.toUpperCase();
}

interface OfferRow {
  id: string;
  step_id: string;
  status: string;
  vendor_rate: number | null;
  vendor_rate_unit: string | null;
  vendor_total: number | null;
  vendor_currency: string | null;
  pricing_mode: string | null;
  deadline: string | null;
  expires_at: string | null;
  instructions: string | null;
  offered_at: string;
  offered_by: string | null;
  counter_rate: number | null;
  counter_rate_unit: string | null;
  counter_total: number | null;
  counter_currency: string | null;
  counter_deadline: string | null;
  counter_note: string | null;
  counter_status: string | null;
  counter_at: string | null;
  counter_responded_at: string | null;
  counter_rejection_reason: string | null;
  negotiation_allowed: boolean | null;
}

interface StepRow {
  id: string;
  step_number: number;
  name: string;
  actor_type: string;
  status: string;
  service_id: string | null;
  order_id: string;
  order_document_id: string | null;
  workflow_id: string;
  vendor_rate: number | null;
  vendor_rate_unit: string | null;
  vendor_total: number | null;
  vendor_currency: string | null;
  pricing_mode: string | null;
  source_language: string | null;
  target_language: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  deadline: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  instructions: string | null;
  rejection_reason: string | null;
  revision_count: number | null;
  source_file_paths: unknown;
  delivered_file_paths: unknown;
  requires_file_upload: boolean | null;
  notes_from_vendor: string | null;
  offer_count: number | null;
  created_at: string;
  updated_at: string;
}

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      tab?: "offered" | "active" | "completed";
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const tab = body.tab ?? event.queryStringParameters?.tab ?? "active";
    let jobs: unknown[] = [];

    if (tab === "offered") {
      // Drop offers whose step has already been assigned to someone else
      // (the step.vendor_id is set and isn't us). Once another vendor
      // claims a step, leftover pending offers shouldn't clutter the
      // Offered tab — the vendor can't act on them anyway.
      //
      // Cancelled/completed steps are also filtered.
      //
      // Defense in depth: also drop offers that have expired with no
      // response. These should already be flipped to 'expired' or
      // 'retracted' by the admin-side action handler when the step is
      // reset, but occasionally an admin path leaves them stale and
      // there's no UX value in showing a "deadline passed" pending
      // offer the vendor can't act on. The earlier behaviour was to
      // keep them visible-and-dimmed; that turned out to be confusing
      // (offers appeared "live" in the tab even though they were dead).
      const offers = await query<OfferRow>(
        `SELECT o.id, o.step_id, o.status, o.vendor_rate, o.vendor_rate_unit, o.vendor_total, o.vendor_currency,
                o.pricing_mode, o.deadline, o.expires_at, o.instructions, o.offered_at, o.offered_by,
                o.counter_rate, o.counter_rate_unit, o.counter_total, o.counter_currency,
                o.counter_deadline, o.counter_note, o.counter_status, o.counter_at,
                o.counter_responded_at, o.counter_rejection_reason, o.negotiation_allowed
         FROM vendor_step_offers o
         JOIN order_workflow_steps s ON s.id = o.step_id
         WHERE o.vendor_id = $1
           AND o.status = 'pending'
           AND (s.vendor_id IS NULL OR s.vendor_id = $1)
           AND s.status NOT IN ('cancelled', 'approved', 'completed', 'skipped')
           AND NOT (o.expires_at IS NOT NULL
                    AND o.expires_at < NOW()
                    AND o.responded_at IS NULL)
         ORDER BY o.offered_at DESC`,
        [vendor_id],
      );

      if (offers.length > 0) {
        const stepIds = Array.from(new Set(offers.map((o) => o.step_id)));
        const steps = await query<{
          id: string; step_number: number; name: string; actor_type: string; service_id: string | null;
          order_id: string; source_language: string | null; target_language: string | null;
          source_file_paths: unknown; requires_file_upload: boolean | null; revision_count: number | null; offer_count: number | null;
        }>(
          `SELECT id, step_number, name, actor_type, service_id, order_id, source_language, target_language,
                  source_file_paths, requires_file_upload, revision_count, offer_count
           FROM order_workflow_steps WHERE id = ANY($1::uuid[])`,
          [stepIds],
        );
        const stepMap = new Map(steps.map((s) => [s.id, s]));

        const orderIds = Array.from(new Set(steps.map((s) => s.order_id)));
        const orders = orderIds.length > 0
          ? await query<{ id: string; order_number: string }>(
              `SELECT id, order_number FROM orders WHERE id = ANY($1::uuid[])`,
              [orderIds],
            )
          : [];
        const orderMap = new Map(orders.map((o) => [o.id, o.order_number]));

        const serviceIds = Array.from(new Set(steps.map((s) => s.service_id).filter((x): x is string => !!x)));
        const services = serviceIds.length > 0
          ? await query<{ id: string; name: string }>(
              `SELECT id, name FROM services WHERE id = ANY($1::uuid[])`,
              [serviceIds],
            )
          : [];
        const serviceMap = new Map(services.map((s) => [s.id, s.name]));

        const langUuids = Array.from(new Set([
          ...steps.map((s) => s.source_language).filter((l): l is string => !!l && UUID_RE.test(l)),
          ...steps.map((s) => s.target_language).filter((l): l is string => !!l && UUID_RE.test(l)),
        ]));
        const langCodeMap = await resolveLanguageCodes(langUuids);

        jobs = offers.map((o) => {
          const step = stepMap.get(o.step_id);
          return {
            offer_id: o.id,
            offer_status: o.status,
            vendor_rate: o.vendor_rate,
            vendor_rate_unit: o.vendor_rate_unit,
            vendor_total: o.vendor_total,
            vendor_currency: o.vendor_currency,
            pricing_mode: o.pricing_mode || "per_unit",
            deadline: o.deadline,
            expires_at: o.expires_at,
            instructions: o.instructions,
            offered_at: o.offered_at,
            counter_status: o.counter_status || "none",
            counter_rate: o.counter_rate,
            counter_rate_unit: o.counter_rate_unit,
            counter_total: o.counter_total,
            counter_currency: o.counter_currency,
            counter_deadline: o.counter_deadline,
            counter_note: o.counter_note,
            counter_at: o.counter_at,
            counter_responded_at: o.counter_responded_at,
            counter_rejection_reason: o.counter_rejection_reason,
            negotiation_allowed: o.negotiation_allowed ?? false,
            id: step?.id,
            step_number: step?.step_number,
            name: step?.name,
            actor_type: step?.actor_type,
            status: "offered",
            service_id: step?.service_id,
            service_name: step?.service_id ? serviceMap.get(step.service_id) ?? null : null,
            source_language: step ? resolveLang(step.source_language, langCodeMap) : null,
            target_language: step ? resolveLang(step.target_language, langCodeMap) : null,
            source_file_paths: step?.source_file_paths,
            requires_file_upload: step?.requires_file_upload,
            revision_count: step?.revision_count ?? 0,
            offer_count: step?.offer_count ?? 1,
            order_id: step?.order_id,
            order_number: step ? orderMap.get(step.order_id) ?? null : null,
            customer_name: null,
          };
        });
      }
    } else {
      const statusFilter = tab === "completed"
        ? ["approved", "cancelled"]
        : ["assigned", "accepted", "in_progress", "delivered", "revision_requested"];
      const sortColumn = tab === "completed" ? "approved_at" : "assigned_at";

      const steps = await query<StepRow>(
        `SELECT id, step_number, name, actor_type, status, service_id, order_id, order_document_id, workflow_id,
                vendor_rate, vendor_rate_unit, vendor_total, vendor_currency, pricing_mode,
                source_language, target_language,
                offered_at, assigned_at, accepted_at, started_at, deadline, delivered_at, approved_at,
                instructions, rejection_reason, revision_count, source_file_paths, delivered_file_paths,
                requires_file_upload, notes_from_vendor, offer_count, created_at, updated_at
         FROM order_workflow_steps
         WHERE vendor_id = $1 AND status = ANY($2::text[])
         ORDER BY ${sortColumn} DESC NULLS LAST`,
        [vendor_id, statusFilter],
      );

      if (steps.length > 0) {
        const orderIds = Array.from(new Set(steps.map((s) => s.order_id)));
        const orders = orderIds.length > 0
          ? await query<{ id: string; order_number: string }>(
              `SELECT id, order_number FROM orders WHERE id = ANY($1::uuid[])`,
              [orderIds],
            )
          : [];
        const orderMap = new Map(orders.map((o) => [o.id, o.order_number]));

        const serviceIds = Array.from(new Set(steps.map((s) => s.service_id).filter((x): x is string => !!x)));
        const services = serviceIds.length > 0
          ? await query<{ id: string; name: string }>(
              `SELECT id, name FROM services WHERE id = ANY($1::uuid[])`,
              [serviceIds],
            )
          : [];
        const serviceMap = new Map(services.map((s) => [s.id, s.name]));

        const langUuids = Array.from(new Set([
          ...steps.map((s) => s.source_language).filter((l): l is string => !!l && UUID_RE.test(l)),
          ...steps.map((s) => s.target_language).filter((l): l is string => !!l && UUID_RE.test(l)),
        ]));
        const langCodeMap = await resolveLanguageCodes(langUuids);

        jobs = steps.map((s) => ({
          ...s,
          source_language: resolveLang(s.source_language, langCodeMap),
          target_language: resolveLang(s.target_language, langCodeMap),
          order_number: orderMap.get(s.order_id) ?? null,
          customer_name: null,
          service_name: s.service_id ? serviceMap.get(s.service_id) ?? null : null,
        }));
      }
    }

    // Counts across all three tabs
    const offeredCount = await query<{ n: string }>(
      // Same defensive filter as the offered tab query above: don't
      // count expired/unresponded pending offers, and skip offers
      // where another vendor already has the step.
      `SELECT COUNT(*)::text AS n
       FROM vendor_step_offers o
       JOIN order_workflow_steps s ON s.id = o.step_id
       WHERE o.vendor_id = $1
         AND o.status = 'pending'
         AND (s.vendor_id IS NULL OR s.vendor_id = $1)
         AND s.status NOT IN ('cancelled', 'approved', 'completed', 'skipped')
         AND NOT (o.expires_at IS NOT NULL
                  AND o.expires_at < NOW()
                  AND o.responded_at IS NULL)`,
      [vendor_id],
    );
    const activeCount = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM order_workflow_steps WHERE vendor_id = $1 AND status = ANY($2::text[])`,
      [vendor_id, ["assigned", "accepted", "in_progress", "delivered", "revision_requested"]],
    );
    const completedCount = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM order_workflow_steps WHERE vendor_id = $1 AND status = ANY($2::text[])`,
      [vendor_id, ["approved", "cancelled"]],
    );

    return json({
      success: true,
      jobs,
      counts: {
        offered: Number(offeredCount[0]?.n ?? "0"),
        active: Number(activeCount[0]?.n ?? "0"),
        completed: Number(completedCount[0]?.n ?? "0"),
      },
    });
  } catch (e) {
    console.error("get-jobs error:", e);
    return err("Internal server error", 500, { detail: e instanceof Error ? e.message : String(e) });
  }
};
