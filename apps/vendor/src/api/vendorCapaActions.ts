import { FUNCTIONS_BASE } from "./functionsBase";

// Call the Supabase edge functions directly via FUNCTIONS_BASE (api.cethos.com),
// the same path every other vendor data module uses (purchase orders, trainings,
// guides…). These endpoints have no `/sb` Netlify lambda, so routing through the
// proxy would fall through to the SPA catch-all and return HTML.
const BASE = FUNCTIONS_BASE;

// Open escalations only ever come back in these statuses — once the vendor
// submits, the escalation moves to `response_submitted` and drops off the list.
export type EscalationStatus = "awaiting_ack" | "acknowledged" | "returned";

export interface VendorEscalation {
  id: string;
  status: EscalationStatus;
  ask: string;
  response_due: string | null;
  acknowledged_at: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  evidence_path: string | null;
  response_submitted_at: string | null;
  review_outcome: "accepted" | "returned" | null;
  review_note: string | null;
  created_at: string;
  nc_number: string;
  nc_title: string;
  severity: string | null;
}

interface GetCapaActionsResponse {
  success?: boolean;
  escalations?: VendorEscalation[];
  error?: string;
}

interface RespondResponse {
  success?: boolean;
  escalation?: VendorEscalation;
  error?: string;
}

export async function getCapaActions(token: string): Promise<GetCapaActionsResponse> {
  const res = await fetch(`${BASE}/vendor-get-capa-actions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return res.json();
}

export async function acknowledgeEscalation(
  token: string,
  escalationId: string,
): Promise<RespondResponse> {
  const res = await fetch(`${BASE}/vendor-capa-respond`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "acknowledge", escalation_id: escalationId }),
  });
  return res.json();
}

export async function submitEscalationResponse(
  token: string,
  args: {
    escalationId: string;
    rootCause: string;
    correctiveAction: string;
    preventiveAction?: string;
    file?: File | null;
  },
): Promise<RespondResponse> {
  const form = new FormData();
  form.append("action", "submit");
  form.append("escalation_id", args.escalationId);
  form.append("root_cause", args.rootCause);
  form.append("corrective_action", args.correctiveAction);
  if (args.preventiveAction) form.append("preventive_action", args.preventiveAction);
  if (args.file) form.append("file", args.file);

  const res = await fetch(`${BASE}/vendor-capa-respond`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}
