import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

const LOGO_URL =
  'https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/final_logo_light_bg_cethosAsset%201.svg'

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-cethos-bg-light">
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
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-cethos-border bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 text-center text-sm text-cethos-gray-light">
          &copy; {new Date().getFullYear()} CETHOS Translation Services. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
