// "Return to this page after login" helpers.
//
// A logged-out vendor who opens a deep link (e.g. /gvsa from an email) is
// sent to /login?returnTo=<path>. After login we go back there. The value
// comes from the URL, so it is only honoured when it is a same-site path:
// it must start with a single "/" and must not be a login/activation page.

const NEVER_RETURN_TO = ["/login", "/activate", "/welcome"];

/** A same-site path that is safe to navigate to after login, or null. */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  const path = raw.split(/[?#]/)[0];
  if (NEVER_RETURN_TO.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}

/** The /login URL that brings the vendor back to `pathname + search`. */
export function loginUrlFor(pathname: string, search = ""): string {
  const target = safeReturnTo(`${pathname}${search}`);
  if (!target || target === "/") return "/login";
  return `/login?returnTo=${encodeURIComponent(target)}`;
}
