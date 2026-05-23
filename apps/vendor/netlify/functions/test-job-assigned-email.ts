/**
 * Netlify Function: test-job-assigned-email
 * Sends a test "Job Assigned" email with realistic sample data.
 *
 * POST /sb/test-job-assigned-email
 * Body: { session_token: string, to_email?: string }
 *
 * Restricted to authenticated vendor sessions. If to_email is provided,
 * the test goes there; otherwise it goes to the logged-in vendor's email.
 */

import { requireSession } from "./_lib/session";
import { json, parseBody, err, type NetlifyResponse } from "./_lib/response";
import { sendMailgun } from "./_lib/mailgun";
import { renderJobAssignedEmail } from "./_lib/email-job-assigned";

export const handler = async (event: {
  body: string | null;
  isBase64Encoded?: boolean;
}): Promise<NetlifyResponse> => {
  try {
    const body = parseBody(event.body, event.isBase64Encoded) as {
      session_token?: string;
      to_email?: string;
    };
    const auth = await requireSession(body);
    if ("statusCode" in auth) return auth;

    const toEmail = body.to_email || "ss.raminder@gmail.com";

    const rendered = renderJobAssignedEmail({
      vendor_name: "Raminder",
      order_number: "ORD-2026-10226",
      step_name: "Translation",
      source_language: "EN",
      target_language: "FR",
      service_name: "Certified Translation",
      word_count: 2450,
      page_count: 8,
      deadline: "2026-05-28",
      vendor_rate: 0.12,
      vendor_rate_unit: "per_word",
      vendor_total: 294.0,
      vendor_currency: "CAD",
      instructions:
        "Please use the glossary provided in the reference files. Ensure all legal terminology follows the Canadian French standard. Deliver in DOCX format.",
      portal_url: process.env.VITE_VENDOR_URL || "https://vendor.cethos.com",
      file_count: 2,
    });

    const result = await sendMailgun({
      to: { email: toEmail, name: "Raminder" },
      subject: rendered.subject,
      html: rendered.html,
      tags: ["job-assigned", "test"],
    });

    if (!result.sent) {
      return err(`Email not sent: ${result.reason}`, 502);
    }

    return json({ success: true, sent_to: toEmail });
  } catch (e) {
    console.error("test-job-assigned-email error:", e);
    return err("Internal server error", 500, {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
