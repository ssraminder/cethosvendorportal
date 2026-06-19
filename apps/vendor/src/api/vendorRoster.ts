// API client for the agency roster feature. JSON calls go to FUNCTIONS_BASE
// with the session token in the body (safePost = text/plain, no preflight);
// the CV upload is multipart with the token in the Authorization header.

import { FUNCTIONS_BASE, safePost } from "./functionsBase";

export interface RosterLanguagePair {
  source_language: string;
  target_language: string;
}

export interface RosterLinguist {
  id: string;
  handle: string;
  real_name: string | null;
  competence_basis_code: string | null;
  is_active: boolean;
  iso_attested: boolean;
  iso_attested_at: string | null;
  has_cv: boolean;
  cv_original_filename: string | null;
  cv_uploaded_at: string | null;
  language_pairs: RosterLanguagePair[];
  domain_ids: string[];
  role_codes: string[];
  is_eligible: boolean;
  missing: string[];
  created_at: string;
}

export interface CompetenceBasis {
  code: string;
  role_type_code: string | null;
  short_label: string;
  iso_clause_reference: string | null;
}
export interface RoleType {
  code: string;
  name: string;
  iso_clause_reference: string | null;
}
export interface SubjectMatter {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  level: number | null;
  sort_order: number | null;
}
export interface RosterReference {
  competence_bases: CompetenceBasis[];
  role_types: RoleType[];
  subject_matters: SubjectMatter[];
  languages: { code: string; name: string }[];
}

export interface RosterListResponse {
  success?: boolean;
  roster?: RosterLinguist[];
  reference?: RosterReference;
  error?: string;
}

export interface RosterUpsertPayload {
  id?: string;
  handle: string;
  real_name?: string | null;
  competence_basis_code?: string | null;
  is_active?: boolean;
  iso_attested: boolean;
  language_pairs: RosterLanguagePair[];
  domain_ids: string[];
  role_codes: string[];
}

async function jsonResult<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function listRoster(token: string): Promise<RosterListResponse> {
  const res = await safePost(`${FUNCTIONS_BASE}/vendor-roster-list`, { session_token: token });
  return jsonResult<RosterListResponse>(res);
}

export async function upsertRosterLinguist(
  token: string,
  payload: RosterUpsertPayload,
): Promise<{ success?: boolean; id?: string; is_eligible?: boolean; error?: string; detail?: string }> {
  const res = await safePost(`${FUNCTIONS_BASE}/vendor-roster-upsert`, { ...payload, session_token: token });
  return jsonResult(res);
}

export async function deleteRosterLinguist(
  token: string,
  id: string,
): Promise<{ success?: boolean; mode?: string; error?: string }> {
  const res = await safePost(`${FUNCTIONS_BASE}/vendor-roster-delete`, { id, session_token: token });
  return jsonResult(res);
}

export async function uploadRosterCv(
  token: string,
  rosterLinguistId: string,
  file: File,
): Promise<{ success?: boolean; cv_original_filename?: string; is_eligible?: boolean; error?: string; detail?: string }> {
  const formData = new FormData();
  formData.append("roster_linguist_id", rosterLinguistId);
  formData.append("file", file);
  const res = await fetch(`${FUNCTIONS_BASE}/vendor-roster-upload-cv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets multipart boundary
    body: formData,
  });
  return jsonResult(res);
}
