import { FUNCTIONS_BASE, safePost } from "./functionsBase";

// Prod routes through the same-origin /sb proxy (regional-CORS resilient);
// localhost hits the functions base directly.
const SB = typeof window !== "undefined" && window.location.hostname !== "localhost" ? "/sb" : null;
function fnUrl(name: string): string {
  return SB ? `${SB}/${name}` : `${FUNCTIONS_BASE}/${name}`;
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
}

export interface TrainingLesson {
  id: string;
  order_index: number;
  slug: string;
  title: string;
  body_markdown: string;
  key_rules: string[] | null;
  estimated_minutes: number | null;
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
