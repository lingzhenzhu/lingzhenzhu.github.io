import { externalArrowPath } from './external-arrow';

export function ExternalArrow() {
  return (
    <svg className="external-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={externalArrowPath} />
    </svg>
  );
}
