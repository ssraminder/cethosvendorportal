import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { execSync } from 'child_process'

// Build-time provenance: pin the bundle to the exact git commit + build time.
// Wrapped in try/catch so builds in environments without git still succeed.
function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}
const BUILD_SHA = gitShortSha()
const BUILD_DATE = new Date().toISOString()

export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __APP_BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: mode !== 'production',
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
}))
