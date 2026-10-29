import { useLayoutEffect, useRef, useState } from 'react';

/** List/detail editors share predictable focus when a detail closes or a record is removed. */
export function useRecordSelection() {
  const [selected, select] = useState('');
  const previous = useRef('');
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const fallback = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!selected && previous.current) {
      const row = rows.current.get(previous.current);
      (row?.isConnected ? row : fallback.current)?.focus({ preventScroll: true });
    }
    previous.current = selected;
  }, [selected]);
  const rowRef = (id: string) => (element: HTMLButtonElement | null) => {
    if (element) rows.current.set(id, element);
    else rows.current.delete(id);
  };
  return { selected, select, rowRef, fallback };
}
