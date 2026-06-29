import { useNavigate } from "react-router-dom";
import {
  APP_NAME,
  APP_VERSION,
  BUILD_SHA,
  BUILD_DATE,
  APP_ENV,
} from "../../version";
import {
  PORTAL_SHORT_DESCRIPTION,
  PORTAL_DESCRIPTION,
} from "../../lib/portalDescription";
import { RELEASE_NOTES } from "../../lib/releaseNotes";

function fmtBuildDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * "About this Software" — describes the vendor portal in plain language, reports
 * the exact running version/build, and lists the full release history.
 */
export function AboutSoftware() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-[#0F9DA0] hover:underline font-medium text-sm"
      >
        ← Back
      </button>

      {/* Header / version card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              {PORTAL_SHORT_DESCRIPTION}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#0F9DA0]">
              v{APP_VERSION}
            </div>
            <div className="text-xs text-gray-500 mt-1 capitalize">
              {APP_ENV}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <dt className="text-xs text-gray-500">Version</dt>
            <dd className="text-sm font-mono text-gray-900 mt-0.5">
              {APP_VERSION}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Build (commit)</dt>
            <dd className="text-sm font-mono text-gray-900 mt-0.5">
              {BUILD_SHA}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Built</dt>
            <dd className="text-sm text-gray-900 mt-0.5">
              {fmtBuildDate(BUILD_DATE)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Environment</dt>
            <dd className="text-sm text-gray-900 mt-0.5 capitalize">
              {APP_ENV}
            </dd>
          </div>
        </dl>
      </div>

      {/* Plain-English description */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          About the portal
        </h2>
        <div className="space-y-5">
          {PORTAL_DESCRIPTION.map((section) => (
            <div key={section.heading}>
              <h3 className="text-sm font-semibold text-gray-800 mb-1.5">
                {section.heading}
              </h3>
              <div className="space-y-2">
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Release history */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Release notes
        </h2>
        <ol className="relative border-l border-gray-200 ml-2">
          {RELEASE_NOTES.map((rel) => (
            <li key={rel.version} className="mb-8 ml-6 last:mb-0">
              <span className="absolute -left-1.5 flex items-center justify-center w-3 h-3 bg-[#0F9DA0] rounded-full mt-1.5" />
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  v{rel.version}
                </h3>
                <time className="text-xs text-gray-500">{rel.date}</time>
              </div>
              <p className="text-sm text-gray-700 mt-1 mb-2">{rel.summary}</p>
              <ul className="space-y-1.5">
                {rel.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-[#0F9DA0] mt-0.5">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default AboutSoftware;
