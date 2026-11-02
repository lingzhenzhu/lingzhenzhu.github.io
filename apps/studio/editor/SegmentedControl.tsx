import { useLayoutEffect, useRef } from 'react';
import { Button } from './Button';
import { GlassOptics } from './material/GlassOptics';

type Choice = { value: string; label: string; icon?: string };
/** A moving optical layer under stationary, keyboard-accessible labels. */
export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  className = '',
  role = 'group',
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  className?: string;
  role?: 'group' | 'navigation';
}) {
  const root = useRef<HTMLDivElement>(null),
    lens = useRef<HTMLSpanElement>(null);
  const position = useRef<{ x: number; width: number } | null>(null);
  // Remeasure when the selection or the rendered choices change, not on every render.
  const signature = options.map((choice) => choice.value + choice.label).join('|');
  useLayoutEffect(() => {
    const group = root.current!,
      surface = lens.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const measure = (animate = false) => {
      cancelAnimationFrame(frame);
      const selected = group.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) return;
      const target = { x: selected.offsetLeft, width: selected.offsetWidth };
      const from = position.current;
      // The spring overshoots and stretches the lens. Keep it inside the track (the
      // padding around the first and last choices), or it widens the scrollable area
      // and flashes a scrollbar when it moves to an end.
      const choices = group.querySelectorAll<HTMLElement>('[aria-pressed]');
      const first = choices[0],
        last = choices[choices.length - 1];
      const trackStart = first.offsetLeft,
        trackEnd = last.offsetLeft + last.offsetWidth;
      const paint = (x: number, width: number, stretch = 0) => {
        position.current = { x, width };
        const left = Math.max(trackStart, x - stretch / 2),
          right = Math.min(trackEnd, x + width + stretch / 2);
        surface.style.width = Math.max(0, right - left) + 'px';
        surface.style.transform = `translateX(${left}px) scaleY(${1 - Math.min(0.065, stretch / 300)})`;
      };
      if (!animate || !from || reduced.matches) {
        surface.dataset.moving = 'false';
        paint(target.x, target.width);
        return;
      }
      surface.dataset.moving = 'true';
      const start = performance.now();
      const tick = (time: number) => {
        const elapsed = (time - start) / 1000;
        const progress =
          1 - Math.exp(-9 * elapsed) * (Math.cos(11 * elapsed) + 0.45 * Math.sin(11 * elapsed));
        const stretch =
          Math.sin(Math.PI * Math.min(1, elapsed / 0.68)) * Math.min(20, Math.abs(target.x - from.x) * 0.15);
        paint(
          from.x + (target.x - from.x) * progress,
          from.width + (target.width - from.width) * progress,
          stretch,
        );
        if (elapsed < 0.68) frame = requestAnimationFrame(tick);
        else {
          surface.dataset.moving = 'false';
          paint(target.x, target.width);
        }
      };
      frame = requestAnimationFrame(tick);
    };
    measure(true);
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (!initial) measure();
      initial = false;
    });
    observer.observe(group);
    const snap = () => measure();
    reduced.addEventListener('change', snap);
    let active = true;
    void document.fonts.ready.then(() => {
      if (active && surface.dataset.moving !== 'true') measure();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener('change', snap);
    };
  }, [value, signature]);
  return (
    <div
      className={`segmented-control ${className}`}
      ref={root}
      role={role}
      aria-label={label}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = options.findIndex((choice) => choice.value === value);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value);
        root.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}
    >
      <span ref={lens} className="segment-lens" data-glass="clear" aria-hidden="true">
        <GlassOptics />
      </span>
      {options.map((choice) => (
        <Button
          key={choice.value}
          variant="quiet"
          compactIcons="keep"
          icon={choice.icon}
          aria-current={value === choice.value ? 'page' : undefined}
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}
