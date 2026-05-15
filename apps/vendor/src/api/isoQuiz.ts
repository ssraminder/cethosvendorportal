// API client for the ISO competence MCQ quiz endpoints. Talks to:
//   - vendor-iso-quiz-get    (public, token-gated, fetches 8 random questions)
//   - vendor-iso-quiz-submit (public, token-gated, auto-grades + completes slug)
//
// Same gateway-pass-through pattern as isoEvidence.ts: anon-key in
// Authorization + apikey to satisfy verify_jwt; request token + slug
// in the body are the real authority.

import { FUNCTIONS_BASE, safePost } from "./functionsBase";
import { getSupabaseAnonKey } from "../lib/env";

// Anon key comes from build-time env, not a hardcoded fallback.
// Audit finding M-1. See `../lib/env.ts`.
function makeGatewayHeaders(): Record<string, string> {
  const key = getSupabaseAnonKey();
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: { value: string; label: string }[];
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizPayload {
  success: true;
  data: {
    request_id: string;
    slug: string;
    competence: string;
    domain: string | null;
    threshold_pct: number;
    total_questions: number;
    questions: QuizQuestion[];
  };
}

export interface QuizError {
  success: false;
  error: string;
  status?: string;
}

export async function getIsoQuiz(token: string, slug: string): Promise<QuizPayload | QuizError> {
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-iso-quiz-get`,
    { token, slug },
    makeGatewayHeaders(),
  );
  return (await res.json()) as QuizPayload | QuizError;
}

export interface QuizSubmitResult {
  success: true;
  data: {
    score_pct: number;
    correct_count: number;
    total_count: number;
    threshold_pct: number;
    passed: boolean;
    attempt_number: number;
    all_done: boolean;
    status: string;
  };
}

export async function submitIsoQuiz(
  token: string,
  slug: string,
  answers: Record<string, string>,
): Promise<QuizSubmitResult | QuizError> {
  const res = await safePost(
    `${FUNCTIONS_BASE}/vendor-iso-quiz-submit`,
    { token, slug, answers },
    makeGatewayHeaders(),
  );
  return (await res.json()) as QuizSubmitResult | QuizError;
}
