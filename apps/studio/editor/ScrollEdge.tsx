import { useEffect, useRef } from 'react';

export function ScrollEdge() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      ref.current?.style.setProperty(
        '--edge-visibility',
        String(Math.min(1, Math.max(0, (scrollY - 3) / 62))),
      );
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', scroll, { passive: true });
    paint();
    return () => {
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  // Keep the parent unmasked: a masked parent stops its children sampling the page.
  return (
    <div className="scroll-edge" aria-hidden="true" ref={ref}>
      <i />
      <i />
      <i />
    </div>
  );
}
