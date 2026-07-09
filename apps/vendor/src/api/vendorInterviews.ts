// Moderator console API — talks to the vendor-interviews edge function.
// Session token goes in the body (text/plain, no CORS preflight via safePost).

import { FUNCTIONS_BASE, safePost } from "./functionsBase";

const URL = `${FUNCTIONS_BASE}/vendor-interviews`;

export interface InterviewParticipant {
  invitationId: string;
  bookingId: string;
  status: "confirmed" | "completed" | "no_show";
  name: string;
  rating: number | null;
  attended: boolean | null;
  comments: string | null;
}
export interface ModeratorMessageBatch {
  batchId: string;
  body: string;
  createdAt: string;
  recipients: number;
  relayed: number;
}
export interface InterviewSession {
  slotId: string;
  studyCode: string;
  durationMinutes: number | null;
  startAt: string;
  endAt: string | null;
  meetingLink: string | null;
  isCompleted: boolean;
  canComplete: boolean;
  canMessage: boolean;
  messages: ModeratorMessageBatch[];
  participants: InterviewParticipant[];
}

export async function getMyInterviews(token: string): Promise<InterviewSession[]> {
  const res = await safePost(URL, { session_token: token, action: "list" });
  const data = await res.json().catch(() => ({}));
  if (!data.success) return [];
  return (data.sessions || []) as InterviewSession[];
}

export interface ParticipantResult {
  invitationId: string;
  attended: boolean;
  rating?: number | null;
  comments?: string | null;
}
export async function completeInterview(
  token: string,
  slotId: string,
  participants: ParticipantResult[],
): Promise<{ success: boolean; completed?: number; noShow?: number; rated?: number; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "complete", slotId, participants });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
}

// Blinded relay: the message is emailed to the selected participants by Cethos
// (participants@cethosresearch.com); the moderator never sees their addresses
// and replies go to Cethos staff. invitationIds omitted = all confirmed.
export async function messageParticipants(
  token: string,
  slotId: string,
  message: string,
  invitationIds?: string[],
): Promise<{ success: boolean; sent?: number; failed?: number; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "message", slotId, message, invitationIds });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
}
