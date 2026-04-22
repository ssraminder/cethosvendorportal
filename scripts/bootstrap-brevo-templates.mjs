// One-shot bootstrap: reads supabase/email-templates/manifest.json and
// uploads each template to Brevo by invoking the temporary edge function
// cvp-admin-create-brevo-template. Prints a JSON map of
// { manifestId: brevoTemplateId } at the end.
//
// Usage: node scripts/bootstrap-brevo-templates.mjs
//
// The edge function must be deployed and reachable at
// ${SUPABASE_URL}/functions/v1/cvp-admin-create-brevo-template.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = "https://lmzoyezvsjgsxveoakdr.supabase.co";
const FUNCTION_PATH = "/functions/v1/cvp-admin-create-brevo-template";
const SENDER_NAME = "Vendor Manager - CETHOS";
const SENDER_EMAIL = "recruiting@vendors.cethos.com";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../supabase/email-templates");
const MANIFEST_PATH = path.join(TEMPLATES_DIR, "manifest.json");

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));

const ids = {};
const failures = [];

for (const [i, entry] of manifest.entries()) {
  const htmlPath = path.join(TEMPLATES_DIR, entry.html.replace(/^templates\//, ""));
  const htmlContent = await fs.readFile(htmlPath, "utf8");

  process.stderr.write(
    `  [${String(i + 1).padStart(2)}/${manifest.length}] ${entry.label} ... `
  );

  try {
    const resp = await fetch(`${SUPABASE_URL}${FUNCTION_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entry.label,
        subject: entry.subject,
        htmlContent,
        senderName: SENDER_NAME,
        senderEmail: SENDER_EMAIL,
      }),
    });
    const body = await resp.json();
    if (!resp.ok || !body.ok) {
      process.stderr.write(`FAILED (${resp.status})\n`);
      failures.push({ id: entry.id, status: resp.status, body });
      continue;
    }
    const brevoId = body.brevo?.id;
    ids[entry.id] = brevoId;
    process.stderr.write(`id=${brevoId}\n`);
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    failures.push({ id: entry.id, error: err.message });
  }
}

process.stderr.write("\n--- Results ---\n");
console.log(JSON.stringify({ ids, failures }, null, 2));
