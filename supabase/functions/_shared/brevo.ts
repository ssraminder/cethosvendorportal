/**
 * Shared Brevo (formerly Sendinblue) email helper for CVP edge functions.
 *
 * All Brevo template IDs are defined here. Update when templates are created in the
 * Brevo dashboard.
 */

export const BREVO_TEMPLATES = {
  V1_APPLICATION_RECEIVED: 1,
  V2_PRESCREEN_PASSED: 2,
  V3_TEST_INVITATION: 3,
  V4_TEST_REMINDER_24HR: 4,
  V5_TEST_EXPIRED: 5,
  V6_FINAL_CHANCE_DAY7: 6,
  V7_TEST_RECEIVED: 7,
  V8_UNDER_MANUAL_REVIEW: 8,
  V9_NEGOTIATION_OFFER: 9,
  V10_RATE_AGREED: 10,
  V11_APPROVED_WELCOME: 11,
  V12_REJECTED: 12,
  V13_WAITLISTED: 13,
  V14_PROFILE_NUDGE: 14,
  V15_CERT_EXPIRY: 15,
  V16_LANGUAGE_PAIRS_CHECK: 16,
  V17_REQUEST_MORE_INFO: 17,
} as const;

export type BrevoTemplateKey = keyof typeof BREVO_TEMPLATES;

interface SendEmailOptions {
  to: { email: string; name: string };
  templateId: number;
  params: Record<string, string | number | boolean>;
}

/**
 * Send a transactional email via Brevo.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendBrevoEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    console.error("BREVO_API_KEY not configured — skipping email send");
    return false;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [options.to],
        templateId: options.templateId,
        params: options.params,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Brevo send failed (template ${options.templateId}): ${response.status} — ${errorBody}`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Brevo send error (template ${options.templateId}):`, err);
    return false;
  }
}
