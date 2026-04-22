import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: readonly SearchableSelectOption[] | SearchableSelectOption[]
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  clearable?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className = '',
  clearable = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const visible = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal flex items-center justify-between gap-2"
      >
        <span className={selected ? 'text-cethos-navy truncate' : 'text-gray-400'}>
          {selected?.label ?? placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && selected && (
            <X
              className="w-3.5 h-3.5 text-gray-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cethos-teal"
            />
          </div>
          <div className="overflow-y-auto py-1 flex-1">
            {visible.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            ) : (
              visible.map((opt) => {
                const active = opt.value === value
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                      active ? 'bg-cethos-bg-blue font-medium text-cethos-navy' : 'text-cethos-navy'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check className="w-4 h-4 text-cethos-teal shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
