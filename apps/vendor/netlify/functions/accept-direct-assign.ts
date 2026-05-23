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

    // Log acceptance in notification_log for audit trail
    await query(
      `INSERT INTO notification_log (event_type, step_id, metadata, created_at)
       VALUES ('vendor_direct_accept', $1, $2, now())`,
      [
        stepId,
        JSON.stringify({ vendor_id, accepted_at: new Date().toISOString() }),
      ],
    );

    // Send notification to admin (pm@cethoscorp.com)
    try {
      const vendorRows = await query<{ full_name: string; email: string }>(
        `SELECT full_name, email FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor_id],
      );
      const vendor = vendorRows[0];

      const stepInfoRows = await query<{
        name: string;
        order_id: string;
        step_number: number;
      }>(
        `SELECT name, order_id, step_number FROM order_workflow_steps WHERE id = $1 LIMIT 1`,
        [stepId],
      );
      const stepInfo = stepInfoRows[0];

      if (vendor && stepInfo) {
        const orderRows = await query<{ order_number: string }>(
          `SELECT order_number FROM orders WHERE id = $1 LIMIT 1`,
          [stepInfo.order_id],
        );
        const order = orderRows[0];

        // Send admin notification via Brevo
        const BREVO_KEY = process.env.BREVO_API_KEY;
        if (BREVO_KEY) {
          const adminEmail = "pm@cethoscorp.com";
          const subject = `Vendor accepted: ${order?.order_number ?? "Order"} — Step ${stepInfo.step_number}: ${stepInfo.name}`;
          const htmlBody = `
            <p>Vendor <strong>${vendor.full_name}</strong> (${vendor.email}) has accepted the assignment:</p>
            <ul>
              <li><strong>Order:</strong> ${order?.order_number ?? stepInfo.order_id}</li>
              <li><strong>Step:</strong> ${stepInfo.step_number}. ${stepInfo.name}</li>
            </ul>
            <p>No action required — the step is now in "Accepted" status.</p>
          `;
          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": BREVO_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Cethos Portal", email: "noreply@cethos.com" },
              to: [{ email: adminEmail }],
              subject,
              htmlContent: htmlBody,
              tags: ["vendor-direct-accept"],
            }),
          });
        }
      }
    } catch (emailErr) {
      console.error("Admin notification failed (non-blocking):", emailErr);
    }

    return json({ success: true });
  } catch (e: any) {
    console.error("accept-direct-assign error:", e);
    return err(e.message || "Internal error", 500);
  }
};
