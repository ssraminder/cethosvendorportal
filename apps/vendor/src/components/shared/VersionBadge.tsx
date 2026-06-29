import { Link } from "react-router-dom";
import { VERSION_LABEL } from "../../version";

interface VersionBadgeProps {
  /** If provided, the badge links to this route (e.g. the About page). */
  to?: string;
  className?: string;
}

/**
 * Small footer chip showing the running version, e.g. "v2026.6.0 · 58b04628".
 * Shown at the bottom of the portal so the active version is always visible.
 */
export function VersionBadge({ to, className = "" }: VersionBadgeProps) {
  const base =
    "inline-flex items-center gap-1 text-xs text-gray-400 font-mono tracking-tight";
  if (to) {
    return (
      <Link
        to={to}
        title="About this software"
        className={`${base} hover:text-gray-600 transition-colors ${className}`}
      >
        {VERSION_LABEL}
      </Link>
    );
  }
  return <span className={`${base} ${className}`}>{VERSION_LABEL}</span>;
}

export default VersionBadge;
