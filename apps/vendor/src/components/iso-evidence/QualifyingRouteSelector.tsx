/**
 * QualifyingRouteSelector
 *
 * Surfaces above the requested-items list when the doc-request asked
 * for documents from more than one ISO 17100 §3.1.4 route. The vendor
 * picks ONE route; the page then only shows the documents needed for
 * that route, and auto-declines the items belonging to the other
 * routes with a clear "pursuing route X" reason.
 *
 * Persistence: the chosen route is held in component state. When the
 * vendor picks a route, the parent auto-declines the unrelated slugs
 * via the explain API. Re-loading the page reads the route back from
 * which slugs have completed_at / declined_at set (chosen route =
 * the one whose slugs are not all declined).
 */

import { useMemo } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  QUALIFYING_ROUTES,
  type RouteKey,
  type QualifyingRoute,
} from "../../data/qualifyingRoutes";

interface Props {
  /** Slugs present on the doc-request, with their resolution state. */
  routeItems: Array<{
    slug: string;
    completed_at?: string | null;
    declined_at?: string | null;
  }>;
  /** Currently-locked route, if any. Once locked, vendor can't switch. */
  chosenRoute: RouteKey | null;
  onChoose: (route: QualifyingRoute) => void;
}

export function QualifyingRouteSelector({ routeItems, chosenRoute, onChoose }: Props) {
  // For each route, count its required slugs that are present in the
  // request and how many are resolved.
  const stats = useMemo(() => {
    const byRoute: Record<RouteKey, { present: number; resolved: number }> = {
      a: { present: 0, resolved: 0 },
      b: { present: 0, resolved: 0 },
      c: { present: 0, resolved: 0 },
    };
    const itemMap = new Map(routeItems.map((it) => [it.slug, it]));
    for (const r of QUALIFYING_ROUTES) {
      for (const slug of r.required_slugs) {
        const it = itemMap.get(slug);
        if (!it) continue;
        byRoute[r.key].present++;
        if (it.completed_at || it.declined_at) byRoute[r.key].resolved++;
      }
    }
    return byRoute;
  }, [routeItems]);

  const lockedRoute = chosenRoute
    ? QUALIFYING_ROUTES.find((r) => r.key === chosenRoute) ?? null
    : null;

  return (
    <section className="bg-white border border-teal-200 rounded-xl p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Pick your ISO 17100 qualifying route
        </h2>
        <p className="text-xs text-gray-600">
          ISO 17100 §3.1.4 requires <strong>one of three routes</strong> — pick the one that matches you. We'll only ask for the documents for that route; the others get marked "not applicable" automatically.
        </p>
      </div>

      {!lockedRoute && (
        <div className="space-y-2">
          {QUALIFYING_ROUTES.map((r) => {
            const isApplicable = stats[r.key].present > 0;
            return (
              <button
                key={r.key}
                type="button"
                disabled={!isApplicable}
                onClick={() => onChoose(r)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isApplicable
                    ? "border-gray-200 hover:border-teal-400 hover:bg-teal-50/40 cursor-pointer"
                    : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{r.title}</div>
                    <p className="text-xs text-gray-600 mt-0.5">{r.description}</p>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      <strong>You'll need:</strong> {r.needs_summary}
                    </p>
                  </div>
                  {isApplicable && (
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {lockedRoute && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">
                Pursuing {lockedRoute.title}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{lockedRoute.description}</p>
              <p className="text-[11px] text-gray-500 mt-2">
                <strong>You'll need:</strong> {lockedRoute.needs_summary}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {stats[lockedRoute.key].resolved} of {stats[lockedRoute.key].present} resolved.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
