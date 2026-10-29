import { Button } from './controls';
import { type ReactNode, useState } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortableOperation, useSortable } from '@dnd-kit/react/sortable';

/** A shared pointer/touch/keyboard ordering surface. Inputs never act as drag handles. */
export function SortableList<T extends { id: string }>({
  items,
  label,
  name,
  onMove,
  children,
}: {
  items: T[];
  label: string;
  name: (item: T) => string;
  onMove: (id: string, to: number) => void;
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const [announcement, announce] = useState('');
  return (
    <div aria-label={label} className="sortable-list">
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || !isSortableOperation(event.operation)) return;
          const { source } = event.operation;
          if (!source) return;
          onMove(String(source.id), source.index);
          const item = items.find((item) => item.id === source.id);
          if (item) announce(`${name(item)} moved to position ${source.index + 1}.`);
        }}
      >
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id} index={index} label={name(item)}>
            {(handle) => children(item, index, handle)}
          </SortableRow>
        ))}
      </DragDropProvider>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
function SortableRow({
  id,
  index,
  label,
  children,
}: {
  id: string;
  index: number;
  label: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { ref, handleRef, isDragging } = useSortable({ id, index, transition: null });
  return (
    <div ref={ref} className={isDragging ? 'sortable-row dragging' : 'sortable-row'}>
      {children(
        <Button
          compactIcons="keep"
          type="button"
          ref={handleRef}
          className="drag-handle"
          aria-label={'Reorder ' + label}
          title="Drag to reorder, or press Space then arrow keys. Escape cancels."
        >
          ⠿
        </Button>,
      )}
    </div>
  );
}
