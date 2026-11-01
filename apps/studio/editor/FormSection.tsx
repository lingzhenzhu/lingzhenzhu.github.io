import { useId, type ReactNode } from 'react';
import './forms.css';

/** Named fields with their heading inside the surface, aligned with the inputs. */
export function FormSection({
  title,
  children,
  compact = false,
  className = '',
  headingLevel = 3,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const id = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      role="group"
      aria-labelledby={id}
      className={'form-section ' + className}
      data-density={compact ? 'compact' : undefined}
    >
      <Heading id={id} className="form-section-heading">
        {title}
      </Heading>
      {children}
    </section>
  );
}
