import { useEffect, useState } from 'react';

export function useSidebar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const main = document.querySelector<HTMLElement>('.editor-main');
    const toggle = document.querySelector<HTMLButtonElement>('.sidebar-toggle');
    if (!sidebar || !main) return;
    main.inert = true;
    const choices = () => [...sidebar.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
    choices()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = choices(),
        index = elements.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        elements.at(-1)?.focus();
      } else if (!event.shiftKey && (index === elements.length - 1 || index < 0)) {
        event.preventDefault();
        elements[0]?.focus();
      }
    };
    const media = matchMedia('(max-width: 700px)');
    const resize = () => {
      if (!media.matches) setOpen(false);
    };
    document.addEventListener('keydown', keyboard);
    media.addEventListener('change', resize);
    return () => {
      main.inert = false;
      document.removeEventListener('keydown', keyboard);
      media.removeEventListener('change', resize);
      toggle?.focus();
    };
  }, [open]);
  return [open, setOpen] as const;
}
