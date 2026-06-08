/**
 * Netlify Function: accept-direct-assign
 * Vendor accepts a directly-assigned step (status = "assigned").
 * Moves the step to "accepted" and sets accepted_at.
 *
 * POST /sb/accept-direct-assign
 * Body: { session_token: string, step_id: string }
 */

import { query } from "./_lib/db";
import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { notifyStaffOfStepAccept } from "./_lib/notify-step-accept";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      step_id?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;
    const { vendor_id } = auth;

    const stepId = body.step_id;
    if (!stepId) return err("Missing step_id", 400);

    // Fetch the step and verify it belongs to this vendor and is in "assigned" status
    const steps = await query<{
      id: string;
      vendor_id: string;
      status: string;
      workflow_id: string;
    }>(
      `SELECT id, vendor_id, status, workflow_id
       FROM order_workflow_steps
       WHERE id = $1 LIMIT 1`,
      [stepId],
    );
    const step = steps[0];

    if (!step) {
      return json({ success: false, error: "Step not found" }, 404);
    }

    if (step.vendor_id !== vendor_id) {
      return json(
        { success: false, error: "This step is not assigned to you" },
        403,
      );
    }

    if (step.status !== "assigned") {
      return json(
        {
          success: false,
          error: `Step is in "${step.status}" status, not "assigned"`,
        },
        409,
      );
    }

    // Accept: move to "accepted" and set accepted_at
    await query(
      `UPDATE order_workflow_steps
       SET status = 'accepted', accepted_at = now()
       WHERE id = $1`,
      [stepId],
    );

    // Ensure workflow is in_progress
    if (step.workflow_id) {
      await query(
        `UPDATE order_workflows SET status = 'in_progress'
         WHERE id = $1 AND status = 'not_started'`,
        [step.workflow_id],
      );
    }

    // Notify Cethos staff (assigned PM + shared pm@cethoscorp.com inbox).
    // Best-effort — the step is already 'accepted'; a notification failure
    // must not roll back or surface to the vendor.
    await notifyStaffOfStepAccept({
      stepId,
      vendorId: vendor_id,
      kind: "direct",
    });

    return json({ success: true });
  } catch (e: any) {
    console.error("accept-direct-assign error:", e);
    return err(e.message || "Internal error", 500);
  }
};
