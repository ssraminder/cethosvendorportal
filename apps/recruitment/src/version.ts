// Application version + build metadata for the recruitment site.
// APP_VERSION comes from the release notes (single source of truth). BUILD_SHA
// and BUILD_DATE are injected at build time by Vite (see vite.config.ts).

import { CURRENT_VERSION } from './lib/releaseNotes'

export const APP_NAME = 'Cethos Recruitment'

export const APP_VERSION = CURRENT_VERSION

export const BUILD_SHA: string =
  typeof __APP_BUILD_SHA__ !== 'undefined' ? __APP_BUILD_SHA__ : 'dev'

export const BUILD_DATE: string =
  typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : ''

export const APP_ENV: string = import.meta.env.PROD ? 'production' : 'development'

export const VERSION_LABEL = `v${APP_VERSION}${
  BUILD_SHA && BUILD_SHA !== 'dev' ? ` · ${BUILD_SHA}` : ''
}`
