/**
 * Locally mint Supabase Storage signed URLs without a network call.
 *
 * Supabase signed URLs are HS256-signed JWTs of `{ url: "<bucket>/<path>",
 * iat, exp }`, signed with the project's JWT secret. We can produce them
 * directly in the Lambda — no /storage/v1/object/sign round-trip — which
 * sidesteps the same CF-to-CF block we hit on /functions/v1.
 *
 * The user must set:
 *   SUPABASE_URL          e.g. https://<project>.supabase.co
 *   SUPABASE_JWT_SECRET   from Supabase Dashboard → Project Settings → API
 */

import { createHmac } from "crypto";

const TTL_SECONDS = 3600;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signStorageUrl(bucket: string, path: string): string | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    url: `${bucket}/${path}`,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  const token = `${signingInput}.${base64url(signature)}`;

  return `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeURI(path)}?token=${token}`;
}

export function signSourceFile(storagePath: string): string | null {
  // Same heuristic as the original Supabase function: flat paths live in
  // `ocr-uploads`, slashed paths in `quote-files`.
  const isFlatPath = !storagePath.includes("/");
  const bucket = isFlatPath ? "ocr-uploads" : "quote-files";
  return signStorageUrl(bucket, storagePath);
}

export interface DeliveryFileEntry {
  storage_path: string;
  bucket: string;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
}

/**
 * Parse one `step_deliveries.file_paths` / `order_workflow_steps.source_file_paths`
 * entry. Entries come in two shapes:
 *   - JSON strings: {"storage_path","original_filename","file_size","mime_type","bucket"?}
 *   - plain storage paths (older rows)
 * Bucket resolution (verified against storage.objects, 2026-10-23):
 *   - an explicit `bucket` field wins
 *   - `workflows/...` (staff uploads) and `<order>/certified/...` (affidavits) → quote-files
 *   - everything else (vendor uploads: `<step_id>/v<n>/...`) → vendor-deliveries
 */
export function parseDeliveryEntry(raw: string | null | undefined): DeliveryFileEntry | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  let path = trimmed;
  let originalName: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;
  let bucket: string | null = null;
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as {
        storage_path?: unknown; original_filename?: unknown;
        file_size?: unknown; mime_type?: unknown; bucket?: unknown;
      };
      if (typeof obj.storage_path !== "string" || !obj.storage_path) return null;
      path = obj.storage_path;
      originalName = typeof obj.original_filename === "string" ? obj.original_filename : null;
      fileSize = typeof obj.file_size === "number" ? obj.file_size : null;
      mimeType = typeof obj.mime_type === "string" ? obj.mime_type : null;
      bucket = typeof obj.bucket === "string" && obj.bucket ? obj.bucket : null;
    } catch {
      return null;
    }
  }
  if (!bucket) {
    bucket = path.startsWith("workflows/") || path.includes("/certified/")
      ? "quote-files"
      : "vendor-deliveries";
  }
  return {
    storage_path: path,
    bucket,
    filename: originalName || path.split("/").pop() || "file",
    file_size: fileSize,
    mime_type: mimeType,
  };
}
