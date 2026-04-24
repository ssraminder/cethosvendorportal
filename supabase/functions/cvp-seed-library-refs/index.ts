/**
 * cvp-seed-library-refs
 *
 * Populates `cvp_test_library.reference_translation` for rows that have a
 * source_text but no reference, using Opus (MODEL_QUALITY) to produce a
 * domain-appropriate reference translation into the row's target language.
 *
 * Idempotent: skips rows that already have `reference_translation IS NOT NULL`
 * OR that are already `is_active = true`. Safe to re-run after a partial
 * failure.
 *
 * On success per row:
 *   - Writes reference_translation
 *   - Flips is_active = true
 *   - Clears ai_generation_error
 *   - Title stays prefixed with "[AI-DRAFT]" until staff remove it manually.
 *
 * On failure per row (AI fallback rule):
 *   - Leaves is_active = false
 *   - Writes error message to ai_generation_error
 *   - Continues to next row; does NOT abort the whole run.
 *
 * Usage:
 *   POST /cvp-seed-library-refs
 *   Optional body: { libraryRowId?: string, limit?: number }
 *     - libraryRowId: target a single row (retry a specific failure)
 *     - limit: cap rows processed this invocation (default 25)
 *
 * Response:
 *   { success, data: { processed, succeeded, failed, details: [...] } }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { MODEL_QUALITY } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface LibraryRow {
  id: string;
  title: string;
  source_language_id: string;
  target_language_id: string;
  domain: string;
  difficulty: string;
  source_text: string | null;
  instructions: string | null;
  reference_translation: string | null;
  ai_assessment_rubric: Record<string, number> | null;
  is_active: boolean;
}

interface LanguageRow {
  id: string;
  name: string;
  code: string;
}

const SYSTEM_PROMPT = `You are drafting the REFERENCE TRANSLATION for a CETHOS translator-qualification test. Your output will be used as the gold-standard that applicant translations are scored against, so it must be accurate, idiomatic, and in the precise register the instructions specify.

Hard rules:
- Output ONLY the translated text. No commentary, no markdown fences, no preamble or sign-off.
- Preserve source formatting exactly — headings, numbering schemes (5.1.1, etc.), line breaks, signature blocks, bulleted lists.
- Preserve numeric values, units, lab abbreviations, and regulatory acronyms verbatim unless the instructions explicitly say to translate them.
- Use the target country's accepted terminology for regulatory / clinical / legal terms. When the target language has multiple regional variants, default to the most widely accepted formal register.
- If the source has an ambiguous phrase that a competent translator would flag, resolve it with the most clinically / legally defensible choice and note nothing — applicants are being tested on this same judgement.
- If you literally cannot translate a word (e.g. a brand name, a protocol identifier), leave it in the source language.

Output will be saved as the canonical reference. Treat this as production-quality copy.`;

async function callOpus(args: {
  apiKey: string;
  sourceText: string;
  sourceLangName: string;
  targetLangName: string;
  instructions: string;
  domain: string;
  difficulty: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const userMessage = `Source language: ${args.sourceLangName}
Target language: ${args.targetLangName}
Domain: ${args.domain}
Difficulty: ${args.difficulty}

Instructions given to the applicant (follow these in your reference too):
${args.instructions || "(none — use your best professional judgement)"}

Source text to translate:
---
${args.sourceText}
---

Produce the reference translation now. Output ONLY the translation.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_QUALITY,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `${resp.status}: ${body.slice(0, 500)}` };
    }

    const data = (await resp.json()) as {
      content: { type: string; text?: string }[];
    };
    const text =
      (data.content ?? []).find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) return { ok: false, error: "empty response from Opus" };
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      { success: false, error: "ANTHROPIC_API_KEY not configured" },
      500,
    );
  }

  let body: { libraryRowId?: string; limit?: number } = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    // empty body OK
  }
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Load rows needing a reference. Only rows with a non-empty source_text are
  // candidates — rows missing source_text will be handled in a separate
  // T2 pass.
  let q = supabase
    .from("cvp_test_library")
    .select(
      "id, title, source_language_id, target_language_id, domain, difficulty, source_text, instructions, reference_translation, ai_assessment_rubric, is_active",
    )
    .is("reference_translation", null)
    .eq("is_active", false)
    .not("source_text", "is", null)
    .limit(limit);

  if (body.libraryRowId) q = q.eq("id", body.libraryRowId);

  const { data: rows, error: queryErr } = await q;
  if (queryErr) {
    return json(
      { success: false, error: `query failed: ${queryErr.message}` },
      500,
    );
  }

  const candidates = (rows ?? []) as unknown as LibraryRow[];
  if (candidates.length === 0) {
    return json({
      success: true,
      data: { processed: 0, succeeded: 0, failed: 0, details: [] },
    });
  }

  // Resolve language names once (not per row) so the prompt is human-readable.
  const langIds = Array.from(
    new Set(
      candidates.flatMap((r) => [r.source_language_id, r.target_language_id]),
    ),
  );
  const { data: langs } = await supabase
    .from("languages")
    .select("id, name, code")
    .in("id", langIds);
  const langMap = new Map<string, LanguageRow>(
    ((langs ?? []) as unknown as LanguageRow[]).map((l) => [l.id, l]),
  );

  const details: Array<{
    id: string;
    title: string;
    ok: boolean;
    error?: string;
  }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const row of candidates) {
    const srcLang = langMap.get(row.source_language_id);
    const tgtLang = langMap.get(row.target_language_id);
    if (!srcLang || !tgtLang) {
      const error = `language lookup failed (src=${row.source_language_id} tgt=${row.target_language_id})`;
      await supabase
        .from("cvp_test_library")
        .update({
          ai_generation_error: error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
      details.push({ id: row.id, title: row.title, ok: false, error });
      continue;
    }

    const result = await callOpus({
      apiKey,
      sourceText: row.source_text ?? "",
      sourceLangName: srcLang.name,
      targetLangName: tgtLang.name,
      instructions: row.instructions ?? "",
      domain: row.domain,
      difficulty: row.difficulty,
    });

    if (!result.ok) {
      await supabase
        .from("cvp_test_library")
        .update({
          ai_generation_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
      details.push({
        id: row.id,
        title: row.title,
        ok: false,
        error: result.error,
      });
      continue;
    }

    // Persist the reference and flip to active. ai_generation_error is
    // cleared even if it was populated from an earlier run.
    const { error: updateErr } = await supabase
      .from("cvp_test_library")
      .update({
        reference_translation: result.text,
        is_active: true,
        ai_generation_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) {
      failed += 1;
      details.push({
        id: row.id,
        title: row.title,
        ok: false,
        error: `update failed: ${updateErr.message}`,
      });
      continue;
    }

    succeeded += 1;
    details.push({ id: row.id, title: row.title, ok: true });
  }

  return json({
    success: true,
    data: {
      processed: candidates.length,
      succeeded,
      failed,
      details,
    },
  });
});
