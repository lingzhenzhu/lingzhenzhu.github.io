import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './ui';
import { Button } from './Button';
export { Button, IconButton } from './Button';
export function Toolbar({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`action-toolbar ${className}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Keeps destructive actions in the same focus-safe, asynchronous confirmation flow. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
  returnFocusTo,
  cancelWhileBusy = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  cancelWhileBusy?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <Dialog
      title={title}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      dismissible={!busy || cancelWhileBusy}
    >
      {children}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <Toolbar label="Confirmation" className="dialog-actions">
        <Button data-dialog-focus autoFocus disabled={busy && !cancelWhileBusy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onConfirm();
              if (mounted.current) onClose();
            } catch (failure) {
              if (mounted.current) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'The action could not be completed. Try again.',
                );
                setBusy(false);
              }
            }
          }}
        >
          {confirmLabel}
        </Button>
      </Toolbar>
    </Dialog>
  );
}

export function StatusMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'busy' | 'success' | 'error';
}) {
  return (
    <span className="save-status" data-tone={tone} role="status">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function Pagination({
  page,
  count,
  pageSize,
  onChange,
}: {
  page: number;
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const total = Math.max(1, Math.ceil(count / pageSize));
  if (total === 1) return null;
  return (
    <Toolbar label="List pagination" className="list-pagination">
      <Button icon="back" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span role="status">
        {page + 1} of {total}
      </span>
      <Button icon="arrow" disabled={page >= total - 1} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </Toolbar>
  );
}
