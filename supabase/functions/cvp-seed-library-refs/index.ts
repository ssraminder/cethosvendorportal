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

const REFERENCE_SYSTEM_PROMPT = `You are drafting the REFERENCE TRANSLATION for a CETHOS translator-qualification test. Your output will be used as the gold-standard that applicant translations are scored against, so it must be accurate, idiomatic, and in the precise register the instructions specify.

Hard rules:
- Output ONLY the translated text. No commentary, no markdown fences, no preamble or sign-off.
- Preserve source formatting exactly — headings, numbering schemes (5.1.1, etc.), line breaks, signature blocks, bulleted lists.
- Preserve numeric values, units, lab abbreviations, and regulatory acronyms verbatim unless the instructions explicitly say to translate them.
- Use the target country's accepted terminology for regulatory / clinical / legal terms. When the target language has multiple regional variants, default to the most widely accepted formal register.
- If the source has an ambiguous phrase that a competent translator would flag, resolve it with the most clinically / legally defensible choice and note nothing — applicants are being tested on this same judgement.
- If you literally cannot translate a word (e.g. a brand name, a protocol identifier), leave it in the source language.

Output will be saved as the canonical reference. Treat this as production-quality copy.`;

const SOURCE_SYSTEM_PROMPT = `You are drafting SOURCE TEXT for a CETHOS translator-qualification test. The applicant will translate this text from the source language into the target language. The text will be reviewed by human QA before going live.

Hard rules:
- Output ONLY the source-language text. No preamble, no notes, no markdown fences.
- Write in the SOURCE language named in the user message. Do NOT write in the target language.
- Realistic, domain-appropriate content. No copyrighted material — synthesise fresh.
- Length: 250–450 words depending on difficulty (beginner ~250, intermediate ~350, advanced ~450).
- Use formatting appropriate to the content type (bullets, numbered sections, ALL-CAPS headings, etc. — only where realistic).
- Build in 3–6 translation challenges appropriate to the domain + difficulty: technical terms, ambiguous anaphora, domain idioms, register shifts, specific number/unit handling, etc. These will be what scorers look for.
- Do NOT use "Lorem ipsum" or placeholder text. Every sentence should be real-looking content.
- Use fully fictional names, companies, and addresses.

Output goes straight into a test-library row; quality matters.`;

async function callOpus(args: {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
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
        max_tokens: args.maxTokens ?? 4000,
        system: args.systemPrompt,
        messages: [{ role: "user", content: args.userMessage }],
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

function referenceUserMessage(args: {
  sourceText: string;
  sourceLangName: string;
  targetLangName: string;
  instructions: string;
  domain: string;
  difficulty: string;
}): string {
  return `Source language: ${args.sourceLangName}
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
}

function sourceUserMessage(args: {
  sourceLangName: string;
  targetLangName: string;
  domain: string;
  difficulty: string;
  titleStem: string;
  instructions: string;
}): string {
  return `Write a SOURCE TEXT in ${args.sourceLangName}. It will be translated by test-takers into ${args.targetLangName}.

Domain: ${args.domain}
Difficulty: ${args.difficulty}
Content type hint (from the test title): ${args.titleStem}

Instructions that will be given to the applicant alongside your source text:
${args.instructions || "(none given)"}

Requirements:
- Write in ${args.sourceLangName} only.
- Target length for ${args.difficulty} difficulty: ${args.difficulty === "beginner" ? "~250 words" : args.difficulty === "intermediate" ? "~350 words" : "~450 words"}.
- Domain-realistic. Build in 3–6 translation challenges appropriate to ${args.domain}.
- Use fully fictional names, companies, and addresses.
- Do NOT include a heading like "Source text:" — output only the text itself.

Write the source text now. Output ONLY the text in ${args.sourceLangName}.`;
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

  // Load rows needing a reference OR a source_text. As of T4 (Apr 24),
  // rows can be seeded with source_text NULL — the function generates
  // source first, then the reference.
  let q = supabase
    .from("cvp_test_library")
    .select(
      "id, title, source_language_id, target_language_id, domain, difficulty, source_text, instructions, reference_translation, ai_assessment_rubric, is_active",
    )
    .is("reference_translation", null)
    .eq("is_active", false)
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

    // Stage 1: generate source_text if missing.
    let sourceText = row.source_text;
    if (!sourceText || sourceText.trim().length === 0) {
      const srcGen = await callOpus({
        apiKey,
        systemPrompt: SOURCE_SYSTEM_PROMPT,
        userMessage: sourceUserMessage({
          sourceLangName: srcLang.name,
          targetLangName: tgtLang.name,
          domain: row.domain,
          difficulty: row.difficulty,
          titleStem: row.title.replace(/^\[AI-DRAFT\]\s*/, "").replace(/\s*\([^)]+\)$/, ""),
          instructions: row.instructions ?? "",
        }),
        maxTokens: 2500,
      });
      if (!srcGen.ok) {
        await supabase
          .from("cvp_test_library")
          .update({
            ai_generation_error: `source: ${srcGen.error}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed += 1;
        details.push({
          id: row.id,
          title: row.title,
          ok: false,
          error: `source: ${srcGen.error}`,
        });
        continue;
      }
      sourceText = srcGen.text;
      // Persist source_text right away so a retry on Stage 2 failure
      // doesn't re-generate the source.
      await supabase
        .from("cvp_test_library")
        .update({
          source_text: sourceText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }

    // Stage 2: generate reference_translation.
    const refGen = await callOpus({
      apiKey,
      systemPrompt: REFERENCE_SYSTEM_PROMPT,
      userMessage: referenceUserMessage({
        sourceText,
        sourceLangName: srcLang.name,
        targetLangName: tgtLang.name,
        instructions: row.instructions ?? "",
        domain: row.domain,
        difficulty: row.difficulty,
      }),
      maxTokens: 4000,
    });

    if (!refGen.ok) {
      await supabase
        .from("cvp_test_library")
        .update({
          ai_generation_error: `reference: ${refGen.error}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
      details.push({
        id: row.id,
        title: row.title,
        ok: false,
        error: `reference: ${refGen.error}`,
      });
      continue;
    }

    // Persist the reference and flip to active. ai_generation_error is
    // cleared even if it was populated from an earlier run.
    const { error: updateErr } = await supabase
      .from("cvp_test_library")
      .update({
        reference_translation: refGen.text,
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
