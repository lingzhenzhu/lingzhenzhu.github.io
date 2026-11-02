import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';
import { Icon } from './icons';

/** Icon, title and description sit on one grid, so every card in a set aligns
 * whatever its text length, and cards can be added or removed freely. */
export function ChoiceCard({
  icon,
  title,
  description,
  className = '',
  ...props
}: Omit<ButtonProps, 'children' | 'icon' | 'title'> & { icon: string; title: string; description?: string }) {
  return (
    <Button {...props} compactIcons="keep" className={'choice-card ' + className}>
      <Icon name={icon} />
      <span className="choice-card-text">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
    </Button>
  );
}

export function ChoiceGrid({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="choice-grid" role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}
