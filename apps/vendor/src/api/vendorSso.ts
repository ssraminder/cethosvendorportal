/**
 * Federated SSO client helper. Posts to `/sb/sso-issue` and resolves to
 * the URL the browser should navigate to. Same `text/plain` simple-CORS
 * convention as the rest of the /sb/* endpoints.
 *
 * Usage:
 *   const url = await issueSso(sessionToken, "tm", { jobExternalRef: job.external_ref });
 *   window.location.href = url;
 *
 * Throws on network failure or server error so the caller can surface a
 * useful message — typically the same "couldn't reach Cethos" handling
 * used elsewhere in the auth flow.
 */

const SSO_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/sb"
    : (import.meta.env.VITE_AUTH_BASE ?? "/sb");

export type SsoTarget = "tm";

export interface IssueSsoOptions {
  /** Optional deep-link reference. For TM this is the job external_ref. */
  jobExternalRef?: string;
}

export class SsoIssueError extends Error {
  // erasableSyntaxOnly disallows parameter-property shorthand, so the
  // fields are declared and assigned explicitly.
  readonly status: number;
  readonly serverMessage: string;

  constructor(status: number, serverMessage: string) {
    super(`SSO issue failed (${status}): ${serverMessage}`);
    this.name = "SsoIssueError";
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

interface SsoResponse {
  sso_url?: string;
  error?: string;
}

export async function issueSso(
  sessionToken: string,
  target: SsoTarget,
  opts: IssueSsoOptions = {},
): Promise<string> {
  const res = await fetch(`${SSO_BASE}/sso-issue`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      session_token: sessionToken,
      target,
      job_external_ref: opts.jobExternalRef,
    }),
  });
  const payload = (await res.json()) as SsoResponse;
  if (!res.ok || !payload.sso_url) {
    throw new SsoIssueError(res.status, payload.error ?? "unknown error");
  }
  return payload.sso_url;
}
