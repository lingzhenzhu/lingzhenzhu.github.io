import type { SelectHTMLAttributes } from 'react';
export interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Native form data remains the source of truth; the enhanced picker is optional. */
export function FilterSelect({
  id,
  name,
  label,
  options,
  selectProps,
  className = '',
}: {
  id: string;
  name: string;
  label: string;
  options: FilterOption[];
  selectProps?: SelectHTMLAttributes<HTMLSelectElement>;
  className?: string;
}) {
  return (
    <span className={'filter-select ' + className} data-filter-select>
      <select name={name} aria-label={label} disabled {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls={id}
        data-filter-trigger
        hidden
        disabled
      >
        <span data-filter-value>{options[0]?.label}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <div
        id={id}
        className="filter-options"
        role="listbox"
        aria-label={label}
        popover="auto"
        data-filter-options
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={id + '-' + index}
            role="option"
            aria-selected={index === 0}
            aria-disabled={option.disabled || undefined}
            data-value={option.value}
          >
            {option.label}
          </div>
        ))}
      </div>
    </span>
  );
}
