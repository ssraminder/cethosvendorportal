import { useEffect, useRef, type ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

const COMPONENTS_SCRIPT_URL =
  (import.meta.env.VITE_CETHOS_COMPONENTS_URL as string | undefined) ??
  'https://cethos.com/embed/cethos-components.js'

const LOGO_URL =
  'https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/final_logo_light_bg_cethosAsset%201.svg'

function useCethosComponentsScript() {
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || typeof window === 'undefined') return
    loadedRef.current = true
    const existing = document.querySelector(
      'script[src$="cethos-components.js"]',
    )
    if (existing) return
    const script = document.createElement('script')
    script.src = COMPONENTS_SCRIPT_URL
    script.async = true
    document.body.appendChild(script)
  }, [])
}

// Fallback minimal header for when cethos-components.js fails to load —
// matches what the recruitment app shipped before this PR.
function FallbackHeader() {
  return (
    <header className="bg-white border-b border-cethos-border">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="CETHOS"
            className="h-8 w-auto"
            loading="eager"
            decoding="async"
          />
          <span className="text-cethos-border">|</span>
          <span className="text-sm text-cethos-gray">Vendor Recruitment</span>
        </div>
      </div>
    </header>
  )
}

function FallbackFooter() {
  return (
    <footer className="border-t border-cethos-border bg-white mt-12">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 text-center text-sm text-cethos-gray-light">
        &copy; {new Date().getFullYear()} CETHOS Translation Services. All rights reserved.
      </div>
    </footer>
  )
}

export function Layout({ children }: LayoutProps) {
  useCethosComponentsScript()
  return (
    <div className="min-h-screen bg-cethos-bg-light flex flex-col">
      <cethos-header current-site="recruitment" hide-cta>
        <FallbackHeader />
      </cethos-header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:px-6">
        {children}
      </main>
      <cethos-footer>
        <FallbackFooter />
      </cethos-footer>
    </div>
  )
}
