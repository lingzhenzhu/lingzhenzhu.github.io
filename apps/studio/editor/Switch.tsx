import type { InputHTMLAttributes } from 'react';

/** Native checkbox behaviour with a shared optical switch presentation. */
export function Switch(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'>) {
  return (
    <span className="studio-switch">
      <input {...props} type="checkbox" role="switch" />
      <span aria-hidden="true" />
    </span>
  );
}
