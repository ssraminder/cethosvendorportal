// Batch-convert Mustache section syntax to Brevo-compatible output.
//
// Brevo's template engine does NOT support classical Mustache `{{#var}}...{{/var}}`
// sections or inverted `{{^var}}...{{/var}}` sections. It supports:
//   - Simple substitution: {{ params.x }}
//   - Conditionals: {% if params.x %}...{% else %}...{% endif %}
//
// Since our edge functions always pass every param, we can safely:
//   - Unwrap `{{#params.X}}CONTENT{{/params.X}}` → CONTENT
//   - Drop `{{^params.X}}FALLBACK{{/params.X}}` → (nothing)
//
// This is destructive of the fallback branches but matches how our code
// actually calls Brevo (all params always populated).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../supabase/email-templates");

const files = (await fs.readdir(TEMPLATES_DIR)).filter((f) => f.endsWith(".html"));

for (const file of files) {
  const fullPath = path.join(TEMPLATES_DIR, file);
  const original = await fs.readFile(fullPath, "utf8");

  // Loop until stable — nested sections need multiple passes.
  let out = original;
  for (let pass = 0; pass < 10; pass++) {
    const before = out;
    out = out.replace(
      /\{\{\^params\.([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/params\.\1\}\}/g,
      ""
    );
    out = out.replace(
      /\{\{#params\.([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/params\.\1\}\}/g,
      "$2"
    );
    if (out === before) break;
  }

  if (out !== original) {
    await fs.writeFile(fullPath, out, "utf8");
    console.log(`rewrote ${file}`);
  } else {
    console.log(`no change ${file}`);
  }
}
