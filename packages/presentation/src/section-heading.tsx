import type { ReactNode } from 'react';

/** Section labels follow Home's heading style, independent of editable rich-text marks. */
export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 className="section-heading" id={id}>
      {children}
    </h2>
  );
}
