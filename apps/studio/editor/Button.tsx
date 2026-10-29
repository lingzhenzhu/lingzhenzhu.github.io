import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon } from './icons';
import './controls.css';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  icon?: string;
  variant?: 'default' | 'primary' | 'danger' | 'quiet';
  compactIcons?: 'hide' | 'keep';
  busy?: boolean;
};

/** Text actions share size, feedback and responsive rules, including their optional icon. */
export function Button({
  icon,
  variant = 'default',
  compactIcons = 'hide',
  busy = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-compact-icons={compactIcons}
      className={`studio-button ${variant} ${className}`}
    >
      {busy ? <span className="button-progress" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  ...props
}: Omit<ButtonProps, 'children' | 'icon'> & {
  label: string;
  icon: string;
}) {
  return (
    <Button
      {...props}
      icon={icon}
      compactIcons="keep"
      aria-label={label}
      title={props.title || label}
      className={`icon-button ${props.className || ''}`}
    />
  );
}
