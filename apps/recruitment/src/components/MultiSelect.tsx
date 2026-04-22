import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: readonly MultiSelectOption[] | MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchable?: boolean
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options…',
  searchable = true,
  className = '',
}: MultiSelectProps) {
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

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  const remove = (v: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((x) => x !== v))
  }

  const q = query.trim().toLowerCase()
  const visibleOptions = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[42px] rounded-md border border-gray-300 bg-white px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal flex items-center justify-between gap-2"
      >
        <div className="flex flex-wrap gap-1.5 flex-1">
          {value.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            value.map((v) => {
              const opt = options.find((o) => o.value === v)
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-cethos-bg-blue px-2 py-0.5 text-xs text-cethos-teal"
                >
                  {opt?.label ?? v}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-600"
                    onClick={(e) => remove(v, e)}
                  />
                </span>
              )
            })
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cethos-teal"
              />
            </div>
          )}
          <div className="overflow-y-auto py-1 flex-1">
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            ) : (
              visibleOptions.map((opt) => {
                const selected = value.includes(opt.value)
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                      selected ? 'bg-cethos-bg-blue' : ''
                    }`}
                  >
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded border ${
                        selected ? 'bg-cethos-teal border-cethos-teal' : 'border-gray-300'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className={selected ? 'font-medium text-cethos-navy' : 'text-cethos-navy'}>
                      {opt.label}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5 bg-gray-50">
              <span className="text-xs text-gray-500">{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-gray-600 hover:text-red-600"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
