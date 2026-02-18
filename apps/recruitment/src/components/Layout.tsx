import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold text-gray-900 tracking-tight">
              CETHOS
            </div>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">Vendor Recruitment</span>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} CETHOS. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
