// JobDetail is now handled by JobBoard via the /jobs/:id route.
// This file is kept for backward compatibility with any imports.
// The actual detail view is rendered as a modal inside JobBoard.

export { JobBoard as JobDetail } from "./JobBoard";
