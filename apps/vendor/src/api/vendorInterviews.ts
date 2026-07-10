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
export interface InterviewFile {
  name: string;
  path: string;
  url: string;
  sentAt: string;
}
export interface InterviewSession {
  slotId: string;
  studyCode: string;
  durationMinutes: number | null;
  startAt: string;
  endAt: string | null;
  meetingLink: string | null;
  files: InterviewFile[];
  isCompleted: boolean;
  canComplete: boolean;
  canMessage: boolean;
  messages: ModeratorMessageBatch[];
  participants: InterviewParticipant[];
}

// A staff request for this moderator's availability on a study, plus the
// moderator's own proposals and their review outcomes.
export interface SlotProposal {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
  reviewNote: string | null;
  createdAt: string;
}
export interface AvailabilityRequest {
  studyId: string;
  studyCode: string;
  durationMinutes: number | null;
  targetLocale: string | null;
  meetingPlatform: string | null;
  /** "focus_group" = one shared session — Cethos confirms ONE of the proposed times. */
  interviewType: "individual" | "focus_group" | null;
  /** offered = not yet responded; accepted = you accepted and are proposing times. */
  offerStatus: "offered" | "accepted";
  offeredAt: string;
  expiresAt: string | null;
  requestedAt: string;
  requestNote: string | null;
  proposals: SlotProposal[];
}
export interface MyInterviews {
  sessions: InterviewSession[];
  availabilityRequests: AvailabilityRequest[];
}

export async function getMyInterviews(token: string): Promise<MyInterviews> {
  const res = await safePost(URL, { session_token: token, action: "list" });
  const data = await res.json().catch(() => ({}));
  if (!data.success) return { sessions: [], availabilityRequests: [] };
  return {
    sessions: (data.sessions || []) as InterviewSession[],
    availabilityRequests: (data.availabilityRequests || []) as AvailabilityRequest[],
  };
}

// Propose session timings for a study staff offered. Times are wall-clock in
// the given IANA timezone; each session's length comes from the study.
export async function proposeTimes(
  token: string,
  studyId: string,
  timezone: string,
  slots: { date: string; time: string }[],
  note?: string,
): Promise<{ success: boolean; proposed?: number; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "propose_times", studyId, timezone, slots, note });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
}

export async function withdrawProposal(
  token: string,
  proposalId: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "withdraw_proposal", proposalId });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
}

// Decline the interview offer (other candidates are unaffected).
export async function declineOffer(
  token: string,
  studyId: string,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "decline_offer", studyId, note });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
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
  attachPaths?: string[],
): Promise<{ success: boolean; sent?: number; failed?: number; error?: string }> {
  const res = await safePost(URL, { session_token: token, action: "message", slotId, message, invitationIds, attachPaths });
  return res.json().catch(() => ({ success: false, error: "Request failed" }));
}
