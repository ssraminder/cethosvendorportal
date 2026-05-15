/**
 * requireStaff() — authentication helper for staff-only edge functions.
 *
 * Pattern: the function is deployed with verify_jwt=false (project
 * convention, see admin repo memory note 2026-05-11). The gateway does
 * NOT validate the Authorization header — we do it inside the function
 * by passing the bearer token to supabase.auth.getUser() and then
 * resolving the staff_users row.
 *
 * Callers must invoke via `supabase.functions.invoke(...)` from a
 * signed-in admin session (the SDK attaches the Supabase auth JWT as
 * Authorization: Bearer ...). Hand-rolled fetch without the header
 * will fail with 401.
 *
 * Returns the verified staff_users.id so callers must STOP trusting
 * `body.staffId` for attribution — audit-log columns
 * (approved_by, staff_reviewed_by, acknowledged_by, etc.) should use
 * the returned staffId instead.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface StaffContext {
  staffId: string;
  authUserId: string;
  email: string;
  fullName: string | null;
  role: string;
}

export type RequireStaffResult =
  | { ok: true; staff: StaffContext }
  | { ok: false; status: 401 | 403; error: string };

export async function requireStaff(req: Request): Promise<RequireStaffResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "missing_bearer_token" };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: "empty_bearer_token" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { ok: false, status: 401, error: "auth_env_missing" };
  }

  // Verify the JWT with Supabase auth. Use a client scoped to the caller's
  // token; getUser() then returns the user if and only if the JWT is valid
  // and unexpired.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  // Resolve staff_users by auth_user_id. Use service role to bypass RLS
  // and avoid the possibility of an RLS policy referencing requireStaff()
  // recursively.
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: staff, error: staffErr } = await adminClient
    .from("staff_users")
    .select("id, auth_user_id, email, full_name, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (staffErr || !staff) {
    return { ok: false, status: 403, error: "not_staff" };
  }
  if (!staff.is_active) {
    return { ok: false, status: 403, error: "staff_inactive" };
  }

  return {
    ok: true,
    staff: {
      staffId: staff.id,
      authUserId: staff.auth_user_id,
      email: staff.email,
      fullName: staff.full_name,
      role: staff.role,
    },
  };
}
