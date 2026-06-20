// Lists the published guides/manuals a vendor may view (audience vendor/all),
// each with a short-lived signed download URL.
import { FUNCTIONS_BASE, safePost } from "./functionsBase";

export interface VendorGuide {
  id: string;
  doc_code: string | null;
  title: string;
  description: string | null;
  category: string | null;
  version: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  updated_at: string | null;
  url: string | null;
}

export async function listGuides(
  token: string,
): Promise<{ success?: boolean; documents?: VendorGuide[]; error?: string }> {
  const res = await safePost(`${FUNCTIONS_BASE}/vendor-list-documents`, { session_token: token });
  return (await res.json()) as { success?: boolean; documents?: VendorGuide[]; error?: string };
}
