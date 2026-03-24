import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Group options if they have group property
  const hasGroups = filtered.some((o) => o.group);
  const grouped = hasGroups
    ? filtered.reduce<Record<string, SelectOption[]>>((acc, o) => {
        const g = o.group || "Other";
        if (!acc[g]) acc[g] = [];
        acc[g].push(o);
        return acc;
      }, {})
    : null;

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setSearch("");
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setSearch("");
    },
    [onChange]
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const renderOptions = (items: SelectOption[]) =>
    items.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => handleSelect(o.value)}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 hover:text-teal-700 ${
          o.value === value ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-700"
        }`}
      >
        {o.label}
      </button>
    ));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-400"}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              onKeyDown={() => {}}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className="h-3 w-3 text-gray-400" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                  setSearch("");
                }
                if (e.key === "Enter" && filtered.length === 1) {
                  handleSelect(filtered[0].value);
                }
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">
                No results found
              </div>
            ) : grouped ? (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                    {group}
                  </div>
                  {renderOptions(items)}
                </div>
              ))
            ) : (
              renderOptions(filtered)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
