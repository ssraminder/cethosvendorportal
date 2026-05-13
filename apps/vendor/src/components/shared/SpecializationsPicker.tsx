/**
 * SpecializationsPicker
 *
 * Multi-select chip picker for vendor subject specializations. Vendors
 * type to filter a curated list (~35 entries grouped by category), pick
 * matching options, and can also add a custom free-text value when
 * nothing fits. Emits a string[] of canonical labels.
 *
 * Render contract:
 *   - Chips of selected values at the top, with × to remove.
 *   - Combobox input below; focus opens the dropdown.
 *   - Dropdown shows grouped options; click to add (then clears input).
 *   - If the typed text doesn't match any option, a "+ Add 'foo' as
 *     custom" row appears at the bottom.
 *   - Esc closes the dropdown; Enter adds the highlighted option or the
 *     custom value.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronDown, Plus } from "lucide-react";
import {
  SPECIALIZATIONS,
  searchSpecializations,
  type Specialization,
} from "../../data/specializations";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SpecializationsPicker({
  value,
  onChange,
  placeholder = "Type to search — Legal, Medical, Marketing…",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const matches: Specialization[] = useMemo(() => {
    const all = query.trim() ? searchSpecializations(query) : SPECIALIZATIONS;
    return all.filter((s) => !selectedSet.has(s.label.toLowerCase()));
  }, [query, selectedSet]);

  const grouped = useMemo(() => {
    const acc: Record<string, Specialization[]> = {};
    for (const s of matches) {
      if (!acc[s.group]) acc[s.group] = [];
      acc[s.group].push(s);
    }
    return acc;
  }, [matches]);

  // Custom-add available when query has content and doesn't exactly match
  // an existing label (case-insensitive) or any current selection.
  const trimmedQuery = query.trim();
  const exactExisting = SPECIALIZATIONS.some(
    (s) => s.label.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const alreadySelected = selectedSet.has(trimmedQuery.toLowerCase());
  const showCustomAdd = trimmedQuery.length >= 2 && !exactExisting && !alreadySelected;

  const add = useCallback(
    (label: string) => {
      const clean = label.trim();
      if (!clean) return;
      if (selectedSet.has(clean.toLowerCase())) return;
      onChange([...value, clean]);
      setQuery("");
      // Keep the picker open so the vendor can add several in a row;
      // also re-focus the input.
      inputRef.current?.focus();
    },
    [value, selectedSet, onChange],
  );

  const remove = (label: string) => {
    onChange(value.filter((v) => v !== label));
  };

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter prefers the first match; otherwise adds custom if eligible.
      if (matches[0]) add(matches[0].label);
      else if (showCustomAdd) add(trimmedQuery);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      // Quick way to remove the last chip — like a tag editor.
      remove(value[value.length - 1]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chip + input area */}
      <div
        className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 border rounded-md bg-white ${
          disabled ? "opacity-50" : "focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200"
        } border-gray-300`}
        onClick={() => { if (!disabled) { inputRef.current?.focus(); setOpen(true); } }}
      >
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-800 border border-teal-200"
          >
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(v); }}
              disabled={disabled}
              className="text-teal-600 hover:text-teal-900"
              aria-label={`Remove ${v}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[180px] px-1 py-0.5 text-sm outline-none border-0 bg-transparent"
        />
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((s) => !s); }}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {Object.keys(grouped).length === 0 && !showCustomAdd && (
            <div className="px-3 py-2 text-gray-400">No matches.</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                {group}
              </div>
              {items.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => add(s.label)}
                  className="w-full text-left px-3 py-1.5 hover:bg-teal-50 text-gray-800"
                >
                  {s.label}
                </button>
              ))}
            </div>
          ))}
          {showCustomAdd && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => add(trimmedQuery)}
                className="w-full text-left px-3 py-2 hover:bg-teal-50 text-teal-700 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add "<strong>{trimmedQuery}</strong>" as custom
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
