import type { InputHTMLAttributes, ReactNode } from 'react';

/** A search input with its magnifier: the same field heads every filtered list. */
export function SearchField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <span className="studio-search-field">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" />
        <path d="m15 15 6 6" />
      </svg>
      <input type="search" {...props} />
    </span>
  );
}

/** One row of list filters: the search field grows, each picker keeps its width,
 * and all controls share one height and centre line. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>;
}
