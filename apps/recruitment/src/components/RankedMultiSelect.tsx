import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, X } from 'lucide-react'

export interface RankedMultiSelectOption {
  value: string
  label: string
}

interface RankedMultiSelectProps {
  options: readonly RankedMultiSelectOption[] | RankedMultiSelectOption[]
  /** Ordered array; index 0 = 1st preference, etc. */
  value: string[]
  onChange: (next: string[]) => void
  maxSelections?: number
  placeholder?: string
  rankLabels?: string[]
  className?: string
}

const DEFAULT_RANK_LABELS = ['1st', '2nd', '3rd', '4th', '5th']

export function RankedMultiSelect({
  options,
  value,
  onChange,
  maxSelections = 3,
  placeholder = 'Select…',
  rankLabels = DEFAULT_RANK_LABELS,
  className = '',
}: RankedMultiSelectProps) {
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

  const atMax = value.length >= maxSelections

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v))
      return
    }
    if (atMax) return
    onChange([...value, v])
  }

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[42px] rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-cethos-teal focus:border-cethos-teal flex items-center justify-between gap-2"
      >
        <span className="flex-1 truncate">
          {value.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <span className="text-cethos-navy">
              {value.length} selected · max {maxSelections}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {value.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {value.map((v, idx) => {
            const opt = options.find((o) => o.value === v)
            return (
              <div
                key={v}
                className="flex items-center gap-2 rounded-md border border-cethos-border bg-white px-2.5 py-1.5 text-sm"
              >
                <span className="inline-flex items-center justify-center min-w-[2.5rem] rounded-md bg-cethos-bg-blue px-1.5 py-0.5 text-xs font-semibold text-cethos-teal">
                  {rankLabels[idx] ?? `#${idx + 1}`}
                </span>
                <span className="flex-1 text-cethos-navy truncate">{opt?.label ?? v}</span>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-gray-400 hover:text-cethos-teal disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === value.length - 1}
                  className="p-1 text-gray-400 hover:text-cethos-teal disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  aria-label="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

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
          {atMax && (
            <div className="px-3 py-1.5 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
              Max {maxSelections} selections reached. Remove one to add another.
            </div>
          )}
          <div className="overflow-y-auto py-1 flex-1">
            {visible.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            ) : (
              visible.map((opt) => {
                const selected = value.includes(opt.value)
                const disabled = !selected && atMax
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                    } ${selected ? 'bg-cethos-bg-blue' : ''}`}
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
                    {selected && (
                      <span className="ml-auto text-xs text-cethos-teal">
                        {rankLabels[value.indexOf(opt.value)] ?? `#${value.indexOf(opt.value) + 1}`}
                      </span>
                    )}
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
