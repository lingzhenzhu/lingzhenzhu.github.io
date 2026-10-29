import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';
import { Icon } from './icons';
export { Icon } from './icons';
export function Dialog({
  title,
  children,
  onClose,
  dismissible = true,
  returnFocusTo,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  returnFocusTo?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    // Safari does not focus buttons on pointer activation. Callers identify
    // the trigger explicitly so mouse and keyboard dismissals behave alike.
    const opener =
      returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const workspace = el.closest('main');
    el.showModal();
    // React autofocus runs while the native dialog is still closed. Apply the
    // explicitly chosen, safe starting control after it becomes interactive.
    el.querySelector<HTMLElement>('[data-dialog-focus]')?.focus();
    return () => {
      el.close();
      if (opener?.isConnected) opener.focus();
      // Deleting an item may remove its trigger or the entire inspector.
      // Keep the keyboard in the surviving, labelled editing workspace.
      else if (workspace?.isConnected) workspace.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="studio-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Close dialog" icon="close" disabled={!dismissible} onClick={onClose} />
      </header>
      {children}
    </dialog>
  );
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <Icon name="pages" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
