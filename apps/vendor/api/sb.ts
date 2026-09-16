/**
 * Vercel serverless entrypoint for the /sb same-origin proxy.
 *
 * One function hosts all of the Netlify Functions in ../netlify/functions
 * unchanged: vercel.json rewrites /sb/:name (and /.well-known/jwks.json)
 * here, and this adapter converts Vercel's (req, res) into the minimal
 * Netlify-style event each handler expects, then writes the handler's
 * { statusCode, headers, multiValueHeaders, body } result back.
 *
 * Vercel preserves the ORIGINAL request path in req.url on a rewrite, so
 * the handler name is parsed from /sb/<name>, not from /api/sb.
 *
 * Vercel compiles these TS modules to unbundled native ESM at runtime,
 * which has no extensionless/directory import resolution — that is why
 * every relative import under netlify/functions carries an explicit .js
 * extension (esbuild on the Netlify side resolves .js -> .ts natively,
 * so the Netlify deploy is unaffected).
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { handler as authCheck } from "../netlify/functions/auth-check.js";
import { handler as authOtpSend } from "../netlify/functions/auth-otp-send.js";
import { handler as authOtpVerify } from "../netlify/functions/auth-otp-verify.js";
import { handler as authPassword } from "../netlify/functions/auth-password.js";
import { handler as setPassword } from "../netlify/functions/set-password.js";
import { handler as listDevices } from "../netlify/functions/list-devices.js";
import { handler as revokeDevice } from "../netlify/functions/revoke-device.js";
import { handler as jwks } from "../netlify/functions/jwks.js";
import { handler as ssoIssue } from "../netlify/functions/sso-issue.js";
import { handler as authLogout } from "../netlify/functions/auth-logout.js";
import { handler as authSession } from "../netlify/functions/auth-session.js";
import { handler as getJobs } from "../netlify/functions/get-jobs.js";
import { handler as getJobDetail } from "../netlify/functions/get-job-detail.js";
import { handler as getSelfcheck } from "../netlify/functions/get-selfcheck.js";
import { handler as acceptStep } from "../netlify/functions/accept-step.js";
import { handler as declineStep } from "../netlify/functions/decline-step.js";
import { handler as getProfile } from "../netlify/functions/get-profile.js";
import { handler as updateProfile } from "../netlify/functions/update-profile.js";
import { handler as updateAvailability } from "../netlify/functions/update-availability.js";
import { handler as updateLanguagePairs } from "../netlify/functions/update-language-pairs.js";
import { handler as manageRates } from "../netlify/functions/manage-rates.js";
import { handler as updatePaymentInfo } from "../netlify/functions/update-payment-info.js";
import { handler as lookupTaxRate } from "../netlify/functions/lookup-tax-rate.js";
import { handler as getNdaStatus } from "../netlify/functions/get-nda-status.js";
import { handler as ndaOtpSend } from "../netlify/functions/nda-otp-send.js";
import { handler as ndaOtpVerify } from "../netlify/functions/nda-otp-verify.js";
import { handler as signNda } from "../netlify/functions/sign-nda.js";
import { handler as getAgreementStatus } from "../netlify/functions/get-agreement-status.js";
import { handler as requestContractorUpgrade } from "../netlify/functions/request-contractor-upgrade.js";
import { handler as listDocRequests } from "../netlify/functions/list-doc-requests.js";
import { handler as uploadCv } from "../netlify/functions/upload-cv.js";
import { handler as listCvs } from "../netlify/functions/list-cvs.js";
import { handler as getInvoices } from "../netlify/functions/get-invoices.js";
import { handler as getPurchaseOrders } from "../netlify/functions/get-purchase-orders.js";
import { handler as raiseInvoice } from "../netlify/functions/raise-invoice.js";
import { handler as getInvoicePdf } from "../netlify/functions/get-invoice-pdf.js";
import { handler as submitInvoice } from "../netlify/functions/submit-invoice.js";
import { handler as acceptDirectAssign } from "../netlify/functions/accept-direct-assign.js";
import { handler as testJobAssignedEmail } from "../netlify/functions/test-job-assigned-email.js";
import { handler as getOnboardingPackage } from "../netlify/functions/get-onboarding-package.js";
import { handler as signOnboardingPackage } from "../netlify/functions/sign-onboarding-package.js";
import { handler as getOnboardingByToken } from "../netlify/functions/get-onboarding-by-token.js";
import { handler as signOnboardingByToken } from "../netlify/functions/sign-onboarding-by-token.js";

interface SbResult {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
}

// Each handler declares only the event fields it uses; the full event we
// build is assignable to every one of those narrower parameter types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SbHandler = (event: any) => Promise<SbResult>;

const routes: Record<string, SbHandler> = {
  "auth-check": authCheck,
  "auth-otp-send": authOtpSend,
  "auth-otp-verify": authOtpVerify,
  "auth-password": authPassword,
  "set-password": setPassword,
  "list-devices": listDevices,
  "revoke-device": revokeDevice,
  "jwks": jwks,
  "sso-issue": ssoIssue,
  "auth-logout": authLogout,
  "auth-session": authSession,
  "get-jobs": getJobs,
  "get-job-detail": getJobDetail,
  "get-selfcheck": getSelfcheck,
  "accept-step": acceptStep,
  "decline-step": declineStep,
  "get-profile": getProfile,
  "update-profile": updateProfile,
  "update-availability": updateAvailability,
  "update-language-pairs": updateLanguagePairs,
  "manage-rates": manageRates,
  "update-payment-info": updatePaymentInfo,
  "lookup-tax-rate": lookupTaxRate,
  "get-nda-status": getNdaStatus,
  "nda-otp-send": ndaOtpSend,
  "nda-otp-verify": ndaOtpVerify,
  "sign-nda": signNda,
  "get-agreement-status": getAgreementStatus,
  "request-contractor-upgrade": requestContractorUpgrade,
  "list-doc-requests": listDocRequests,
  "upload-cv": uploadCv,
  "list-cvs": listCvs,
  "get-invoices": getInvoices,
  "get-purchase-orders": getPurchaseOrders,
  "raise-invoice": raiseInvoice,
  "get-invoice-pdf": getInvoicePdf,
  "submit-invoice": submitInvoice,
  "accept-direct-assign": acceptDirectAssign,
  "test-job-assigned-email": testJobAssignedEmail,
  "get-onboarding-package": getOnboardingPackage,
  "sign-onboarding-package": signOnboardingPackage,
  "get-onboarding-by-token": getOnboardingByToken,
  "sign-onboarding-by-token": signOnboardingByToken,
};

/** Fallback when the platform body helper is absent: read the raw stream. */
async function readRawBody(req: IncomingMessage): Promise<string | null> {
  if (!req.readable) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : null;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://sb.local");
  const path = url.pathname;

  let name: string | null = null;
  if (path === "/.well-known/jwks.json") {
    name = "jwks";
  } else {
    const m = path.match(/^\/(?:api\/)?sb\/([a-z0-9-]+)\/?$/);
    if (m) name = m[1];
  }

  const fn = name ? routes[name] : undefined;
  if (!fn) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // Vercel's body helper parses JSON bodies into an object; handlers expect
  // the raw string (they run it through their own parseBody). Re-serialize
  // objects, pass strings/Buffers through, fall back to the raw stream.
  let body: string | null;
  const parsed = req.body;
  if (typeof parsed === "string") {
    body = parsed;
  } else if (Buffer.isBuffer(parsed)) {
    body = parsed.toString("utf8");
  } else if (parsed !== undefined && parsed !== null) {
    body = JSON.stringify(parsed);
  } else {
    body = await readRawBody(req);
  }

  // Node lowercases header names and pre-joins duplicates (cookie with
  // "; "). Flatten the rare string[] values the same way Netlify does.
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }

  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    queryStringParameters[k] = v;
  });

  try {
    const out = await fn({
      httpMethod: req.method ?? "GET",
      path,
      headers,
      queryStringParameters,
      body,
      isBase64Encoded: false,
    });

    res.statusCode = out.statusCode;
    for (const [k, v] of Object.entries(out.headers ?? {})) {
      res.setHeader(k, v);
    }
    for (const [k, v] of Object.entries(out.multiValueHeaders ?? {})) {
      res.setHeader(k, v);
    }
    res.end(out.body ?? "");
  } catch (e) {
    // Never log request bodies here (payout_details rule) — name + error only.
    console.error(`[sb] ${name} failed:`, e instanceof Error ? e.message : e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
