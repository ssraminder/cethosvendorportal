// Application version + build metadata for the vendor portal.
//
// APP_VERSION is derived from the release notes (the single source of truth).
// BUILD_SHA and BUILD_DATE are injected at build time by Vite (see vite.config.ts
// `define`). Together they pin a running portal to the exact git commit and build
// time it was produced from — important for audit traceability.

import { CURRENT_VERSION } from "./lib/releaseNotes";

export const APP_NAME = "Cethos Vendor Portal";

/** Published, human-facing version, e.g. "2026.6.0". */
export const APP_VERSION = CURRENT_VERSION;

/** Short git commit the build was made from. "dev" if git was unavailable at build. */
export const BUILD_SHA: string =
  typeof __APP_BUILD_SHA__ !== "undefined" ? __APP_BUILD_SHA__ : "dev";

/** ISO timestamp the build was produced. Empty string in dev when not injected. */
export const BUILD_DATE: string =
  typeof __APP_BUILD_DATE__ !== "undefined" ? __APP_BUILD_DATE__ : "";

/** Runtime environment label ("production" | "development"). */
export const APP_ENV: string = import.meta.env.PROD ? "production" : "development";

/** Compact display string, e.g. "v2026.6.0 · 58b04628". */
export const VERSION_LABEL = `v${APP_VERSION}${
  BUILD_SHA && BUILD_SHA !== "dev" ? ` · ${BUILD_SHA}` : ""
}`;
