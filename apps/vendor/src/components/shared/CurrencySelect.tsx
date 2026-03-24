import { useMemo } from "react";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";
import { CURRENCIES, formatCurrencyLabel } from "../../data/currencies";

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelect({
  value,
  onChange,
  placeholder = "Select currency...",
  disabled = false,
  className = "",
}: CurrencySelectProps) {
  const options: SelectOption[] = useMemo(
    () =>
      CURRENCIES.map((c) => ({
        value: c.code,
        label: formatCurrencyLabel(c),
      })),
    []
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
