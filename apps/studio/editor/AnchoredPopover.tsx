import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Native top-layer presentation avoids nested glass and scroll-container clipping. */
export function AnchoredPopover({
  id,
  label,
  anchor,
  onClose,
  children,
  className = '',
}: {
  id: string;
  label: string;
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const panel = ref.current!,
      trigger = anchor.current!;
    let frame = 0;
    const position = () => {
      const target = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 16;
      const top = (viewport?.offsetTop ?? 0) + 16;
      const right = left + (viewport?.width ?? innerWidth) - 32;
      const bottom = top + (viewport?.height ?? innerHeight) - 32;
      panel.style.maxWidth = right - left + 'px';
      panel.style.maxHeight = bottom - top + 'px';
      const bounds = { width: panel.offsetWidth, height: panel.offsetHeight };
      // Keep the menu visually connected to its trigger, with the same placement
      // on desktop and phone. Only flip when the space above is unavailable.
      const x = target.left + (target.width - bounds.width) / 2;
      const above = target.top - bounds.height - 12;
      const y = above >= top ? above : target.bottom + 12;
      panel.style.left = Math.max(left, Math.min(x, right - bounds.width)) + 'px';
      panel.style.top = Math.max(top, Math.min(y, bottom - bounds.height)) + 'px';
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    panel.showPopover();
    position();
    (panel.querySelector<HTMLElement>('button:not(:disabled),a[href]') ?? trigger).focus({
      preventScroll: true,
    });
    const dismissOutside = (event: Event) => {
      const target = event.target as Node;
      if (!panel.contains(target) && !trigger.contains(target)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      event.stopPropagation();
      close.current();
      trigger.focus({ preventScroll: true });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    observer.observe(trigger);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', escape, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      panel.hidePopover();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor]);
  return createPortal(
    <div
      ref={ref}
      id={id}
      popover="manual"
      role="dialog"
      aria-label={label}
      data-popover-anchor={anchor.current?.id}
      className={'anchored-popover ' + className}
      data-glass="popover"
    >
      {children}
    </div>,
    document.body,
  );
}
