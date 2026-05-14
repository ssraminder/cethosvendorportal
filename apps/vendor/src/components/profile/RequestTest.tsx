import { useEffect, useMemo, useState } from "react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { GraduationCap, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { FUNCTIONS_BASE } from "../../api/functionsBase";
import { reportApiError } from "../../lib/sentry";

/**
 * RequestTest — vendor self-service for adding a new domain to the
 * translator's approved list.
 *
 * Pattern matches LanguagePairs / VendorRates: session-token auth,
 * direct fetch() to the edge function (no shared API wrapper file yet
 * — inlined for clarity since this is a single screen).
 */

// Keep in lockstep with apps/recruitment/src/lib/domains.ts AND
// cvp_test_combinations.domain CHECK (22 values).
const DOMAIN_LABELS: Record<string, string> = {
  legal: "Legal",
  certified_official: "Certified / Official",
  immigration: "Immigration",
  medical: "Medical",
  life_sciences: "Life Sciences",
  pharmaceutical: "Pharmaceutical",
  financial: "Financial",
  insurance: "Insurance",
  technical: "Technical",
  it_software: "IT & Software",
  automotive_engineering: "Automotive & Engineering",
  energy: "Energy",
  marketing_advertising: "Marketing & Advertising",
  literary_publishing: "Literary & Publishing",
  academic_scientific: "Academic & Scientific",
  government_public: "Government & Public",
  business_corporate: "Business & Corporate",
  gaming_entertainment: "Gaming & Entertainment",
  media_journalism: "Media & Journalism",
  tourism_hospitality: "Tourism & Hospitality",
  general: "General",
  other: "Other",
};

// Excluded from self-service. Certified requires staff manual approval.
const ALL_TESTABLE_DOMAINS = Object.keys(DOMAIN_LABELS).filter(
  (d) => d !== "certified_official" && d !== "other",
);

interface LatestSubmission {
  id: string;
  token: string;
  token_expires_at: string | null;
  status: string;
  ai_assessment_score: number | null;
  submitted_at: string | null;
  created_at: string;
  /** Token from cvp_test_feedback_rounds, used to open the scorecard view
   *  at `${APP_URL}/test-feedback/{feedback_token}`. Null until the
   *  feedback round is created (post-grading). */
  feedback_token?: string | null;
  /** Stable TM editor URL (tm.cethos.com/translator/editor/{job_id}).
   *  Reusable — requires the vendor to be signed into TM, but doesn't
   *  burn on first click like the email's one-shot signin URL. */
  tm_job_url?: string | null;
  tm_job_id?: string | null;
}

interface TranslatorDomainRow {
  id: string;
  source_language_id: string;
  target_language_id: string;
  domain: string;
  status:
    | "pending"
    | "in_review"
    | "approved"
    | "rejected"
    | "skip_manual_review"
    | "revoked";
  cooldown_until: string | null;
  latest_submission?: LatestSubmission | null;
}

interface LanguageRow {
  id: string;
  name: string;
  code: string;
}

interface PairKey {
  srcId: string;
  tgtId: string;
}

export function RequestTest() {
  const { sessionToken, logout } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TranslatorDomainRow[]>([]);
  const [langMap, setLangMap] = useState<Map<string, LanguageRow>>(new Map());
  const [error, setError] = useState<string>("");
  const [requesting, setRequesting] = useState<string | null>(null); // key: src|tgt|domain
  const [appUrl, setAppUrl] = useState<string>("https://join.cethos.com");
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Fetch the translator's domain rows via a helper edge function OR
  // supabase-js directly with anon key. We use a tiny dedicated endpoint
  // `cvp-get-my-domains` to avoid exposing cvp_translator_domains via RLS.
  // For T3 we inline the fetch into cvp-request-test's "preview" mode —
  // see below.
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const base = `${FUNCTIONS_BASE}/cvp-get-my-domains`;
        // Send the vendor session UUID in the body, anon key in the
        // Authorization header so the Supabase gateway's verify_jwt
        // accepts us regardless of how the function was last deployed
        // (MCP defaults to verify_jwt=true; vendor session UUID would
        // otherwise be rejected at the gateway). The function itself
        // prefers body.session_token over the header.
        const anonKey =
          (import.meta as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env
            ?.VITE_SUPABASE_ANON_KEY
          ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtem95ZXp2c2pnc3h2ZW9ha2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDkzNTIsImV4cCI6MjA4NDQyNTM1Mn0.6XtRrAuganzIb65FbG_NKQ8JuOxoPLSXBYsffZg2Y3c";
        const resp = await fetch(base, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ session_token: sessionToken }),
        });
        if (!resp.ok) {
          // Read raw text first instead of resp.json(). Third-party fetch
          // wrappers (Sentry tracing, Apollo extension) sometimes consume
          // the body stream, which makes resp.json() throw "body already
          // read" — we then lose the server's error code. text() is more
          // resilient.
          const rawText = await resp.text().catch(() => "");
          let parsed: { error?: string } = {};
          try {
            parsed = JSON.parse(rawText) as { error?: string };
          } catch {
            /* response wasn't JSON — code falls back to http_<status> */
          }
          const code = String(parsed?.error ?? `http_${resp.status}`);
          // Pre-scrub JWT-shaped substrings before sending to Sentry,
          // otherwise Sentry's PII filter replaces the entire `rawBody`
          // with "[Filtered]" and we can't see the rest of the response.
          const scrubbedBody = rawText
            .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<jwt-scrubbed>")
            .slice(0, 500);
          reportApiError({
            endpoint: "cvp-get-my-domains",
            status: resp.status,
            code,
            extra: { rawBody: scrubbedBody, rawBodyLen: rawText.length },
          });
          // Any 401 from this endpoint means the vendor session is
          // dead (function returns 401 only for session_not_found or
          // session_expired; no_token is 400). Act on the status alone
          // so auto-logout is robust to body-mangling fetch wrappers.
          if (resp.status === 401) {
            await logout();
            return;
          }
          throw new Error(code);
        }
        const data = await resp.json();
        if (cancelled) return;
        setRows(data?.data?.rows ?? []);
        const langs = (data?.data?.languages ?? []) as LanguageRow[];
        setLangMap(new Map(langs.map((l) => [l.id, l])));
        if (data?.data?.app_url) setAppUrl(String(data.data.app_url));
        setError("");
      } catch (err) {
        // Network failure, JSON parse error, or the Error we re-threw
        // above. The HTTP-status branch already reported via
        // reportApiError, so this guard prevents a duplicate Sentry
        // event for the same fetch.
        const alreadyReported =
          err instanceof Error
            && (err.message === "session_not_found"
              || err.message === "session_expired"
              || /^http_\d+$/.test(err.message)
              || err.message === "no_token");
        if (!alreadyReported) {
          reportApiError({ endpoint: "cvp-get-my-domains", error: err });
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, lastResult, logout]);

  // Approved pairs — the translator can only request new domains on pairs
  // they're already active in.
  const approvedPairs: PairKey[] = useMemo(() => {
    const seen = new Set<string>();
    const out: PairKey[] = [];
    for (const r of rows) {
      if (r.status !== "approved") continue;
      const key = `${r.source_language_id}|${r.target_language_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ srcId: r.source_language_id, tgtId: r.target_language_id });
    }
    return out;
  }, [rows]);

  const hasOpenRequest = useMemo(
    () => rows.some((r) => r.status === "pending" || r.status === "in_review"),
    [rows],
  );

  // Map pair → { domain → status-info } for quick UI lookup.
  const byPair = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { status: TranslatorDomainRow["status"]; cooldown: string | null; submission: LatestSubmission | null }>
    >();
    for (const r of rows) {
      const key = `${r.source_language_id}|${r.target_language_id}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(r.domain, {
        status: r.status,
        cooldown: r.cooldown_until,
        submission: r.latest_submission ?? null,
      });
    }
    return map;
  }, [rows]);

  const handleRequest = async (pair: PairKey, domain: string) => {
    const key = `${pair.srcId}|${pair.tgtId}|${domain}`;
    setRequesting(key);
    setLastResult(null);
    try {
      const base = `${FUNCTIONS_BASE}/cvp-request-test`;
      const resp = await fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          sourceLanguageId: pair.srcId,
          targetLanguageId: pair.tgtId,
          domain,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data?.success === false) {
        reportApiError({
          endpoint: "cvp-request-test",
          status: resp.status,
          code: typeof data?.error === "string" ? data.error : undefined,
          extra: { domain, srcId: pair.srcId, tgtId: pair.tgtId },
        });
        setLastResult({
          ok: false,
          message: data?.detail || data?.error || `Failed (HTTP ${resp.status})`,
        });
      } else {
        setLastResult({
          ok: true,
          message: data?.data?.testSent
            ? "Test sent to your email — check your inbox."
            : "Request accepted — test will be sent shortly.",
        });
      }
    } catch (err) {
      reportApiError({
        endpoint: "cvp-request-test",
        error: err,
        extra: { domain, srcId: pair.srcId, tgtId: pair.tgtId },
      });
      setLastResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRequesting(null);
    }
  };

  const pairLabel = (p: PairKey) => {
    const src = langMap.get(p.srcId);
    const tgt = langMap.get(p.tgtId);
    return `${src?.name ?? "?"} → ${tgt?.name ?? "?"}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your approvals…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Failed to load: {error}</p>
      </div>
    );
  }

  if (approvedPairs.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-6 h-6 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Request additional domain tests
              </h2>
              <p className="text-sm text-gray-600">
                You don't have any approved domains yet. Once you're approved
                for at least one domain on a language pair, you'll be able to
                request additional domain tests from this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <div className="flex items-start gap-3 mb-6">
          <GraduationCap className="w-6 h-6 text-teal-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Request additional domain tests
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Expand the domains you can take work in. Pick a language pair
              you're already approved on, then request a test for a new
              domain. You'll receive the test via email within a minute; it
              expires in 48 hours.
            </p>
          </div>
        </div>

        {lastResult && (
          <div
            className={`mb-4 p-3 rounded text-sm flex items-start gap-2 ${
              lastResult.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {lastResult.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>{lastResult.message}</div>
          </div>
        )}

        {hasOpenRequest && (
          <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              You have a test in progress. Complete it before requesting
              another — you can only have one pending test at a time.
            </div>
          </div>
        )}

        <div className="space-y-5">
          {approvedPairs.map((pair) => {
            const statusByDomain = byPair.get(`${pair.srcId}|${pair.tgtId}`) ?? new Map();

            return (
              <div
                key={`${pair.srcId}|${pair.tgtId}`}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {pairLabel(pair)}
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_TESTABLE_DOMAINS.map((domain) => {
                    const existing = statusByDomain.get(domain);
                    const status = existing?.status;
                    const cooldown = existing?.cooldown;
                    const submission = existing?.submission ?? null;
                    const cooldownActive =
                      status === "rejected" &&
                      cooldown &&
                      new Date(cooldown).getTime() > Date.now();
                    const canRequest =
                      !hasOpenRequest &&
                      status !== "approved" &&
                      status !== "pending" &&
                      status !== "in_review" &&
                      status !== "skip_manual_review" &&
                      !cooldownActive;
                    const key = `${pair.srcId}|${pair.tgtId}|${domain}`;
                    const busy = requesting === key;

                    return (
                      <div
                        key={domain}
                        className={`p-3 rounded border text-sm flex items-center justify-between gap-2 ${
                          status === "approved"
                            ? "bg-emerald-50 border-emerald-200"
                            : status === "pending" || status === "in_review"
                            ? "bg-amber-50 border-amber-200"
                            : cooldownActive
                            ? "bg-gray-100 border-gray-300"
                            : status === "rejected"
                            ? "bg-red-50 border-red-200"
                            : "bg-white border-gray-200 hover:border-teal-300"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {DOMAIN_LABELS[domain]}
                          </div>
                          {status === "approved" && (
                            <>
                              <div className="text-[11px] text-emerald-700">Approved</div>
                              {submission?.feedback_token ? (
                                <a
                                  href={`${appUrl}/test-feedback/${submission.feedback_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  View scorecard
                                  {typeof submission.ai_assessment_score === "number" && (
                                    <span className="ml-1 text-gray-500">· {submission.ai_assessment_score}</span>
                                  )}
                                </a>
                              ) : typeof submission?.ai_assessment_score === "number" ? (
                                <div className="text-[11px] text-gray-500 mt-0.5">Score: {submission.ai_assessment_score}</div>
                              ) : null}
                            </>
                          )}
                          {(status === "pending" || status === "in_review") && (
                            <>
                              <div className="text-[11px] text-amber-700">In progress</div>
                              {/* Prefer the stable TM editor URL: vendor signs into
                                  tm.cethos.com with their email + OTP and resumes
                                  the same job. The email's signin_url is one-shot
                                  so we deliberately don't surface it here. */}
                              {submission?.tm_job_url ? (
                                <>
                                  <a
                                    href={submission.tm_job_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5 mt-0.5"
                                  >
                                    Open test in TM &rarr;
                                  </a>
                                  <div className="text-[10px] text-gray-500">Sign in at tm.cethos.com with your email if prompted.</div>
                                </>
                              ) : submission?.token ? (
                                <a
                                  href={`${appUrl}/test/${submission.token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  Open test &rarr;
                                </a>
                              ) : null}
                            </>
                          )}
                          {cooldownActive && cooldown && (
                            <div className="text-[11px] text-gray-600">
                              Try again after{" "}
                              {new Date(cooldown).toISOString().slice(0, 10)}
                            </div>
                          )}
                          {status === "rejected" && !cooldownActive && (
                            <>
                              <div className="text-[11px] text-red-700">
                                Previously rejected — retry available
                              </div>
                              {submission?.feedback_token ? (
                                <a
                                  href={`${appUrl}/test-feedback/${submission.feedback_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  View scorecard
                                  {typeof submission.ai_assessment_score === "number" && (
                                    <span className="ml-1 text-gray-500">· {submission.ai_assessment_score}</span>
                                  )}
                                </a>
                              ) : typeof submission?.ai_assessment_score === "number" ? (
                                <div className="text-[11px] text-gray-500 mt-0.5">Score: {submission.ai_assessment_score}</div>
                              ) : null}
                            </>
                          )}
                        </div>
                        {canRequest && (
                          <button
                            type="button"
                            onClick={() => handleRequest(pair, domain)}
                            disabled={busy}
                            className="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Request"
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
