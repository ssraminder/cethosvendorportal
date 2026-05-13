/**
 * VendorDocuments — /documents
 *
 * Surfaces ISO 17100 document requests inside the authed vendor portal
 * so vendors don't need the original email link to act. Each open
 * request links into /iso-evidence/:token (existing Phase 2 page).
 *
 * Phase 1 of this page: list. CV history + cert list are a follow-up.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { useVendorAuth } from "../../context/VendorAuthContext";
import { listMyDocRequests, type MyDocRequest } from "../../api/isoEvidence";

const STATUS_STYLE: Record<MyDocRequest["status"], { bg: string; fg: string; label: string }> = {
  draft: { bg: "bg-gray-100", fg: "text-gray-700", label: "Draft" },
  sent: { bg: "bg-blue-100", fg: "text-blue-800", label: "Action needed" },
  partial: { bg: "bg-amber-100", fg: "text-amber-800", label: "In progress" },
  completed: { bg: "bg-emerald-100", fg: "text-emerald-800", label: "Completed" },
  expired: { bg: "bg-gray-100", fg: "text-gray-500", label: "Expired" },
  superseded: { bg: "bg-gray-100", fg: "text-gray-500", label: "Superseded" },
};

function StatusBadge({ status }: { status: MyDocRequest["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

export function VendorDocuments() {
  const { sessionToken } = useVendorAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MyDocRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sessionToken) return;
      setLoading(true);
      setError(null);
      const r = await listMyDocRequests(sessionToken);
      if (cancelled) return;
      setLoading(false);
      if (!r.success) { setError(r.error ?? "Could not load requests"); return; }
      setRequests(r.requests ?? []);
    }
    load();
    return () => { cancelled = true; };
  }, [sessionToken]);

  const open = requests.filter((r) => ["sent", "partial"].includes(r.status));
  const past = requests.filter((r) => !["sent", "partial"].includes(r.status));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Requests from Cethos for ISO 17100 evidence — degrees, certifications, language proficiency, and profile fields. Click any open request to upload or fill in what's needed.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-base font-medium text-gray-800 mb-1">No document requests yet</h2>
          <p className="text-sm text-gray-500">
            When Cethos needs evidence on file — a certification, a degree, a profile field — it'll show up here.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Action needed
          </h2>
          <div className="space-y-2">
            {open.map((r) => <RequestRow key={r.id} request={r} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Past requests
          </h2>
          <div className="space-y-2">
            {past.map((r) => <RequestRow key={r.id} request={r} historic />)}
          </div>
        </section>
      )}
    </div>
  );
}

function RequestRow({ request, historic = false }: { request: MyDocRequest; historic?: boolean }) {
  const items = request.requested_items ?? [];
  const resolvedCount = items.filter((it) => !!it.completed_at || !!it.declined_at).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((resolvedCount / total) * 100);
  const expiresAt = new Date(request.request_token_expires_at);
  const expiresSoon = !historic && expiresAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const inner = (
    <div className={`bg-white border rounded-xl p-4 ${historic ? "border-gray-200" : "border-teal-200 hover:border-teal-400 hover:shadow-sm"} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText className={`w-4 h-4 ${historic ? "text-gray-400" : "text-teal-600"} shrink-0`} />
            <span className="text-sm font-medium text-gray-900">
              ISO 17100 evidence request
            </span>
            <StatusBadge status={request.status} />
          </div>
          <div className="text-xs text-gray-500">
            Sent {new Date(request.created_at).toLocaleDateString()}
            {!historic && (
              <>
                <span className="mx-1.5">·</span>
                <span className={expiresSoon ? "text-amber-700 font-medium" : ""}>
                  {expiresSoon ? "Expires soon — " : "Expires "}
                  {expiresAt.toLocaleDateString()}
                </span>
              </>
            )}
            {request.reminder_count > 0 && !historic && (
              <>
                <span className="mx-1.5">·</span>
                <span>{request.reminder_count} reminder{request.reminder_count === 1 ? "" : "s"} sent</span>
              </>
            )}
          </div>
          {request.staff_message && (
            <p className="mt-2 text-xs text-gray-600 italic line-clamp-2">"{request.staff_message}"</p>
          )}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{resolvedCount} of {total} resolved</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${historic ? "bg-gray-300" : "bg-teal-500"} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {/* Pending-item summary */}
          {!historic && items.some((it) => !it.completed_at && !it.declined_at) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {items
                .filter((it) => !it.completed_at && !it.declined_at)
                .slice(0, 4)
                .map((it) => (
                  <span key={it.slug} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                    <Clock className="w-2.5 h-2.5" />
                    {it.label}
                  </span>
                ))}
              {items.filter((it) => !it.completed_at && !it.declined_at).length > 4 && (
                <span className="text-[11px] text-gray-500 self-center">
                  +{items.filter((it) => !it.completed_at && !it.declined_at).length - 4} more
                </span>
              )}
            </div>
          )}
          {historic && request.status === "completed" && (
            <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Completed {request.completed_at ? new Date(request.completed_at).toLocaleDateString() : ""}
            </p>
          )}
          {historic && (request.status === "expired" || request.status === "superseded") && (
            <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {STATUS_STYLE[request.status].label}
            </p>
          )}
        </div>
        {!historic && <ChevronRight className="w-5 h-5 text-gray-300 self-center shrink-0" />}
      </div>
    </div>
  );

  // Historic requests aren't clickable — their token is invalid (expired
  // or superseded) so /iso-evidence/:token won't resolve them anyway.
  if (historic) return inner;
  return (
    <Link to={`/iso-evidence/${request.request_token}`} className="block">
      {inner}
    </Link>
  );
}
