/**
 * dropbox-trigger.ts — Fire-and-forget helper for triggering Dropbox sync
 * from vendor portal edge functions.
 *
 * Identical to the admin portal's copy. Both repos deploy to the same
 * Supabase project, so the dropbox-sync function URL is the same.
 */

interface SyncOrderFileParams {
  order_id: string;
  source_bucket: string;
  source_path: string;
  sync_trigger: string;
  filename?: string;
  quote_id?: string;
  quote_file_id?: string;
  step_delivery_id?: string;
  step_id?: string;
  delivery_version?: number;
}

export async function triggerDropboxSync(params: SyncOrderFileParams): Promise<void> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SRK) {
      console.warn("[dropbox-trigger] SUPABASE_URL or SRK missing, skipping sync");
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/dropbox-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SRK}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sync_order_file",
        ...params,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[dropbox-trigger] sync returned ${res.status}: ${text}`);
    }
  } catch (err: any) {
    console.warn("[dropbox-trigger] sync failed (non-blocking):", err?.message ?? err);
  }
}

/**
 * Push every file a step has produced into its team-Dropbox step folder, via
 * `dropbox-team-sync`'s `sync_step_files` — the same deployed action behind
 * the admin portal's per-step "Dropbox" button and the hourly sweep. Call this
 * after a vendor delivery lands so files appear in Dropbox right away instead
 * of waiting for the sweep. (The legacy `dropbox-sync` function that
 * triggerDropboxSync posts to is not deployed, so that path is a no-op.)
 *
 * `force` is deliberately false: the dropbox_file_syncs dedup skips files
 * already at their destination, so re-triggering on every delivery uploads
 * only what's new.
 *
 * Non-blocking, like the rest of this module.
 */
export async function triggerStepDropboxPush(params: {
  order_id: string;
  step_id: string;
}): Promise<void> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SRK) {
      console.warn("[dropbox-trigger] SUPABASE_URL or SRK missing, skipping step push");
      return;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/dropbox-team-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SRK}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync_step_files", force: false, ...params }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[dropbox-trigger] step push returned ${res.status}: ${text}`);
    }
  } catch (err: any) {
    console.warn("[dropbox-trigger] step push failed (non-blocking):", err?.message ?? err);
  }
}
