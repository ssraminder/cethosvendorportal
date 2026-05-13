// ISO 17100 §3.1.4 — three qualifying routes for translator competence.
// Vendors only need to satisfy ONE route. The doc-request admin UI
// generally ticks all four slugs (degree-a, degree-b, exp-2y, exp-5y);
// this module powers the iso-evidence page's route picker, which lets
// the vendor declare which route they're pursuing and only asks for
// the documents for that route. The other route slugs are auto-
// declined with a clear "pursuing route X" reason.

export type RouteKey = "a" | "b" | "c";

export interface QualifyingRoute {
  key: RouteKey;
  title: string;
  short: string;
  /** Plain-language description shown in the route picker card. */
  description: string;
  /** Slugs that count as evidence for this route. */
  required_slugs: string[];
  /** One-line summary of what the vendor needs to upload. */
  needs_summary: string;
}

export const QUALIFYING_ROUTES: QualifyingRoute[] = [
  {
    key: "a",
    title: "Route (a) — Translation degree",
    short: "Translation degree",
    description:
      "You hold a graduate qualification in translation, interpretation, or linguistics from a recognised university.",
    required_slugs: ["degree_translation_studies", "degree_transcript"],
    needs_summary: "Your diploma — and optionally an academic transcript.",
  },
  {
    key: "b",
    title: "Route (b) — Other degree + 2 years of experience",
    short: "Other degree + 2y experience",
    description:
      "You hold a graduate qualification in any field (not translation) and have at least two years of professional translation experience.",
    required_slugs: ["degree_other_field", "experience_evidence_2y"],
    needs_summary:
      "Your degree certificate + evidence of 2 years' professional translation work (invoices, contracts, portfolio, or a reference letter).",
  },
  {
    key: "c",
    title: "Route (c) — 5 years of experience",
    short: "5y experience only",
    description:
      "You don't hold a graduate qualification, but you have at least five years of professional translation experience.",
    required_slugs: ["experience_evidence_5y"],
    needs_summary:
      "Evidence of 5 years' professional translation work — tax returns (redacted), portfolio listing 50+ dated jobs, multi-year reference letters, or agency vendor-history exports.",
  },
];

/** All route-related slugs across every route, deduplicated. */
export const ALL_ROUTE_SLUGS: ReadonlySet<string> = new Set(
  QUALIFYING_ROUTES.flatMap((r) => r.required_slugs),
);

/** Returns the routes whose required_slugs intersect the request's items. */
export function applicableRoutes(itemSlugs: string[]): QualifyingRoute[] {
  const present = new Set(itemSlugs);
  return QUALIFYING_ROUTES.filter((r) =>
    r.required_slugs.some((s) => present.has(s)),
  );
}
