import { FUNCTIONS_BASE, safePost } from "./functionsBase";

// Call the Supabase edge functions directly via FUNCTIONS_BASE (api.cethos.com
// custom domain) — the same path every other vendor data module uses
// (vendorGuides, vendorRoster, isoQuiz, isoEvidence…). Do NOT route these
// through the `/sb` proxy: that proxy only maps the handful of endpoints
// reimplemented as Netlify lambdas (auth, jobs, profile…). The training
// endpoints have no lambda there, so `/sb/vendor-get-trainings` fell through to
// the SPA catch-all and returned HTML → "Unexpected token '<'… is not valid
// JSON", breaking the whole Trainings page in prod.
function fnUrl(name: string): string {
  return `${FUNCTIONS_BASE}/${name}`;
}

export interface TrainingSummary {
  training_id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  quiz_enabled: boolean;
  lesson_count: number;
  completed: boolean;
  completed_at: string | null;
  method: string | null;
  required: boolean;
}

export interface TrainingLesson {
  id: string;
  order_index: number;
  slug: string;
  title: string;
  body_markdown: string;
  key_rules: string[] | null;
  estimated_minutes: number | null;
  content_blocks: unknown[] | null;
}

export async function getTrainings(token: string): Promise<{ success: boolean; trainings?: TrainingSummary[]; error?: string }> {
  const r = await safePost(fnUrl("vendor-get-trainings"), { session_token: token });
  return r.json();
}

export async function getTrainingDetail(
  token: string,
  trainingId: string,
): Promise<{ success: boolean; training?: { id: string; title: string; description: string; category: string; quiz_enabled: boolean }; lessons?: TrainingLesson[]; completed?: boolean; completed_at?: string | null; error?: string }> {
  const r = await safePost(fnUrl("vendor-get-training-detail"), { session_token: token, training_id: trainingId });
  return r.json();
}

export async function markTrainingComplete(token: string, trainingId: string): Promise<{ success: boolean; error?: string }> {
  const r = await safePost(fnUrl("vendor-mark-training-complete"), { session_token: token, training_id: trainingId });
  return r.json();
}
