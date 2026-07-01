// Lists the published Guides a vendor may view — embeddable how-to videos
// (Guidde / YouTube iframes) and/or uploaded reference documents. Files come
// back with a short-lived signed download URL. Backed by cvp_guides, managed
// by staff from the admin panel (/admin/guides → cvp-manage-guides).
import { FUNCTIONS_BASE, safePost } from "./functionsBase";

export interface VendorGuide {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  embed_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  updated_at: string | null;
  url: string | null;
}

export async function listGuides(
  token: string,
): Promise<{ success?: boolean; guides?: VendorGuide[]; error?: string }> {
  const res = await safePost(`${FUNCTIONS_BASE}/vendor-list-guides`, { session_token: token });
  return (await res.json()) as { success?: boolean; guides?: VendorGuide[]; error?: string };
}
