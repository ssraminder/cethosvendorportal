// ============================================================================
// notify-evidence-submission
//
// When a vendor submits ISO 17100 evidence on the /iso-evidence/:token page,
// the Vendor Management inbox (vendor@cethos.com) needs to know so staff can
// review + verify. Called from vendor-iso-evidence-complete-item and
// vendor-iso-evidence-explain-item whenever a request's status changes
// (sent → partial on first submission, → completed when all items resolved).
//
// Fire-and-forget: never blocks or fails the vendor's action.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendBrevoRawEmail } from "./brevo.ts";
import { callout, ctaButton, COMPANY, emailShell, esc, eyebrow, hint, lead, REPLY, title } from "./email-shell.ts";

const VM_INBOX = "vendor@cethos.com";
const ADMIN_PORTAL_URL = Deno.env.get("ADMIN_PORTAL_URL") ?? "https://portal.cethos.com";

type SB = ReturnType<typeof createClient>;

export async function notifyEvidenceSubmission(args: {
  supabase: SB;
  vendorId: string;
  requestId: string;
  prevStatus: string;
  nextStatus: string;
  resolvedCount: number;
  totalCount: number;
}): Promise<void> {
  const { supabase, vendorId, requestId, prevStatus, nextStatus, resolvedCount, totalCount } = args;

  // Only notify on a real status transition — not on every item.
  if (nextStatus === prevStatus) return;
  if (nextStatus !== "partial" && nextStatus !== "completed") return;

  try {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("full_name, email")
      .eq("id", vendorId)
      .maybeSingle();
    const vendorName = (vendor?.full_name as string) || (vendor?.email as string) || "A vendor";

    const isComplete = nextStatus === "completed";
    const adminUrl = `${ADMIN_PORTAL_URL.replace(/\/$/, "")}/admin/vendors/${vendorId}?tab=documents`;

    const subject = isComplete
      ? `ISO evidence complete — ${vendorName} (ready to review)`
      : `ISO evidence submitted — ${vendorName} (${resolvedCount}/${totalCount})`;

    const body = [
      eyebrow(isComplete ? "Evidence complete" : "Evidence submitted", isComplete ? "success" : "teal"),
      title(isComplete
        ? `${esc(vendorName)} completed their ISO 17100 evidence`
        : `${esc(vendorName)} started submitting ISO 17100 evidence`),
      lead(isComplete
        ? `All ${totalCount} requested item(s) are now resolved (uploaded or declined-with-reason). Please review the documents and verify them in the QMS tab.`
        : `${resolvedCount} of ${totalCount} requested item(s) submitted so far. The vendor may still be working through the rest.`),
      callout({
        tone: isComplete ? "success" : "info",
        title: "What to do next",
        body: isComplete
          ? "Open the vendor's Documents tab to review the uploads, then mark each as Verified on the QMS tab to complete qualification."
          : "No action needed yet — you'll get a second note when the vendor finishes. You can review submitted items anytime.",
      }),
      ctaButton({ label: "Open vendor in admin portal", url: adminUrl }),
      hint(`Request ${requestId} · ${resolvedCount}/${totalCount} resolved.`),
    ].join("");

    const html = emailShell(body, {
      replyTo: REPLY.vendorMgmt,
      template: { name: "Vendor — ISO Evidence Submitted (VM alert)", version: "1.0", updatedAt: "2026-06-18" },
      preheader: `${vendorName} ${isComplete ? "completed" : "submitted"} ISO 17100 evidence.`,
    });

    const result = await sendBrevoRawEmail({
      to: [{ email: VM_INBOX, name: "Cethos Vendor Management" }],
      subject,
      htmlContent: html,
      replyTo: { email: REPLY.vendorMgmt, name: "Cethos Vendor Ops" },
      tags: ["vendor-evidence-submission", isComplete ? "complete" : "partial", `vendor-${vendorId}`],
    });

    // Audit row so the send shows up alongside other notifications.
    await supabase.from("notification_log").insert({
      event_type: "vendor_evidence_submission",
      recipient_type: "staff",
      recipient_email: VM_INBOX,
      recipient_name: "Cethos Vendor Management",
      recipient_id: vendorId,
      subject,
      status: result.sent ? "sent" : "failed",
      error_message: result.sent ? null : (result.reason ?? "unknown"),
      metadata: {
        request_id: requestId,
        vendor_id: vendorId,
        transition: `${prevStatus}->${nextStatus}`,
        resolved_count: resolvedCount,
        total_count: totalCount,
        brevo_message_id: result.messageId ?? null,
      },
    }).then(() => {}, (e: unknown) => console.error("notify-evidence-submission log failed:", e));
  } catch (e) {
    console.error("notifyEvidenceSubmission failed:", e);
  }
}
