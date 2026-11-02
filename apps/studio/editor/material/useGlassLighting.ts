import { useEffect } from 'react';

/** One passive listener for the workspace, with at most one highlight update per frame. */
export function useGlassLighting() {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous: HTMLElement | null = null;
    let point = { x: 0, y: 0, surface: null as HTMLElement | null };
    const move = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return;
      point = {
        x: event.clientX,
        y: event.clientY,
        surface: event.target instanceof Element ? event.target.closest<HTMLElement>('[data-glass]') : null,
      };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const surface = point.surface;
        if (previous && previous !== surface) {
          previous.style.removeProperty('--light-x');
          previous.style.removeProperty('--light-y');
        }
        previous = surface;
        if (!surface) return;
        const bounds = surface.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        surface.style.setProperty('--light-x', `${((point.x - bounds.left) / bounds.width) * 100}%`);
        surface.style.setProperty('--light-y', `${((point.y - bounds.top) / bounds.height) * 100}%`);
      });
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', move);
    };
  }, []);
}
