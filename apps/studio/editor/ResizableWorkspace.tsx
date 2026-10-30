import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './workspace-layout.css';

function splitMetrics(width: number, ratio: number) {
  const available = Math.max(680, width - 12),
    min = 400 / available,
    max = 1 - 280 / available;
  return { available, min, max, value: Math.max(min, Math.min(max, ratio)) };
}

/** One persisted split for every page editor; narrow windows retain full-width content. */
export function ResizableWorkspace({
  enabled,
  children,
}: {
  enabled: boolean;
  children: [ReactNode, ReactNode];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0),
    [dragging, setDragging] = useState(false);
  const [ratio, setRatio] = useState(() => {
    try {
      const value = Number(localStorage.getItem('website-admin-editor-ratio'));
      return value >= 0.2 && value <= 0.85 ? value : 0.6;
    } catch {
      return 0.6;
    }
  });
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    // These measurements describe the accessible separator; CSS owns responsive layout.
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('website-admin-editor-ratio', String(ratio));
    } catch {}
  }, [ratio]);
  const { min, max, value } = splitMetrics(width, ratio);
  const currentMetrics = () => splitMetrics(root.current?.getBoundingClientRect().width || width, ratio);
  const adjust = (next: number) => {
    const current = currentMetrics();
    setRatio(Math.max(current.min, Math.min(current.max, next)));
  };
  return (
    <div
      ref={root}
      className={'page-workspace-body resizable-workspace' + (dragging ? ' resizing' : '')}
      style={{ '--editor-ratio': ratio } as CSSProperties}
    >
      <div className={'workspace-panels' + (enabled ? ' split' : '')}>
        {children[0]}
        {enabled && (
          <div
            className="workspace-divider"
            role="separator"
            aria-label="Editor and preview width"
            aria-orientation="vertical"
            aria-valuemin={Math.round(min * 100)}
            aria-valuemax={Math.round(max * 100)}
            aria-valuenow={Math.round(value * 100)}
            aria-valuetext={`${Math.round(value * 100)} percent editor`}
            tabIndex={0}
            title="Drag to resize · Arrow keys to adjust · Double-click to reset"
            onDoubleClick={() => setRatio(0.6)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const { min, max, value } = currentMetrics();
              adjust(
                event.key === 'Home'
                  ? min
                  : event.key === 'End'
                    ? max
                    : value + (event.key === 'ArrowRight' ? 0.02 : -0.02),
              );
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              event.preventDefault();
              event.currentTarget.focus();
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                const bounds = root.current!.getBoundingClientRect().width;
                const { available } = splitMetrics(bounds, ratio);
                adjust((event.clientX - root.current!.getBoundingClientRect().left) / available);
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(false);
            }}
            onLostPointerCapture={() => setDragging(false)}
          >
            <span />
          </div>
        )}
        {children[1]}
      </div>
    </div>
  );
}
