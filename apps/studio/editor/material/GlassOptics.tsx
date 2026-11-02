import { useId, useLayoutEffect, useRef, useState } from 'react';
import { displacementMap } from './displacement-map';

/** Decorative refraction of the shared ambient scene; text is never rasterised. */
export function GlassOptics() {
  const id = useId().replaceAll(':', '');
  const ref = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState('');
  useLayoutEffect(() => {
    const layer = ref.current!;
    const host = layer.parentElement!;
    const reduce = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)');
    let frame = 0,
      alive = true;
    const measure = () => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (reduce.matches) return;
        const bounds = host.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        layer.style.setProperty('--scene-width', innerWidth + 'px');
        layer.style.setProperty('--scene-height', innerHeight + 'px');
        layer.style.setProperty('--scene-x', -bounds.left + 'px');
        layer.style.setProperty('--scene-y', -bounds.top + 'px');
        // Reuse the map while a selection stretches; do no pixel work per frame.
        if (host.dataset.moving !== 'true')
          setMap(
            displacementMap(
              bounds.width,
              bounds.height,
              parseFloat(getComputedStyle(host).borderTopLeftRadius),
            ),
          );
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    reduce.addEventListener('change', measure);
    void document.fonts.ready.then(measure);
    measure();
    return () => {
      alive = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      reduce.removeEventListener('change', measure);
    };
  }, []);
  return (
    <span ref={ref} className="glass-optics" aria-hidden="true">
      <svg width="0" height="0" focusable="false">
        <defs>
          <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feImage
              href={map || undefined}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="20"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <span className="glass-scene" style={{ filter: map ? `url(#${id})` : undefined }} />
    </span>
  );
}
