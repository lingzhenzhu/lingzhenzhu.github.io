import { useEffect, useState } from 'react';

export function useSidebar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const main = document.querySelector<HTMLElement>('.editor-main');
    const actions = document.querySelector<HTMLElement>('.top-actions');
    const toggle = document.querySelector<HTMLButtonElement>('.sidebar-toggle');
    if (!sidebar || !main) return;
    main.inert = true;
    if (actions) actions.inert = true;
    const choices = () => {
      const overlays = [
        ...document.querySelectorAll<HTMLElement>('[data-popover-anchor]:popover-open'),
      ].filter((panel) => sidebar.contains(document.getElementById(panel.dataset.popoverAnchor!)));
      return [sidebar, ...overlays]
        .flatMap((surface) => [...surface.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')])
        .filter((element) => element.getClientRects().length > 0);
    };
    choices()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = choices(),
        index = elements.indexOf(document.activeElement as HTMLElement);
      if (!elements.length) return;
      event.preventDefault();
      const next =
        index < 0
          ? event.shiftKey
            ? elements.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
      elements[next].focus();
    };
    const media = matchMedia('(max-width: 700px)');
    const resize = () => {
      if (!media.matches) setOpen(false);
    };
    document.addEventListener('keydown', keyboard);
    media.addEventListener('change', resize);
    return () => {
      main.inert = false;
      if (actions) actions.inert = false;
      document.removeEventListener('keydown', keyboard);
      media.removeEventListener('change', resize);
      toggle?.focus();
    };
  }, [open]);
  return [open, setOpen] as const;
}
