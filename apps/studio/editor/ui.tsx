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
  // The trigger is fixed when the dialog opens; later renders must not re-run the modal setup.
  const trigger = useRef(returnFocusTo);
  useEffect(() => {
    const el = ref.current!;
    // Safari does not focus buttons on pointer activation. Callers identify
    // the trigger explicitly so mouse and keyboard dismissals behave alike.
    const opener =
      trigger.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
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
      data-glass="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <IconButton
          variant="quiet"
          label="Close dialog"
          icon="close"
          disabled={!dismissible}
          onClick={onClose}
        />
      </header>
      {children}
    </dialog>
  );
}
type HeadingProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};
/** Title, optional eyebrow, description and action on one grid. The action sits beside
 * the eyebrow and title only, so the description always has the full width and never
 * wraps early because of a button. */
export function HeadingRow({
  eyebrow,
  title,
  description,
  action,
  level = 2,
  className = 'section-heading',
}: HeadingProps & { level?: 1 | 2 | 3; className?: string }) {
  const Title = (['h1', 'h2', 'h3'] as const)[level - 1];
  return (
    <div className={'heading-row ' + className}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Title>{title}</Title>
      {description && <p className="heading-description">{description}</p>}
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
/** The heading of a whole workspace, such as Pages or Publishing. */
export function WorkspaceHeading(props: HeadingProps) {
  return <HeadingRow {...props} level={1} className="workspace-heading" />;
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
