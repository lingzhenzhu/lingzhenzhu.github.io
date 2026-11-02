import { useId, useRef, useState } from 'react';
import { Button, ConfirmDialog } from './controls';
import { Icon } from './icons';
import { AnchoredPopover } from './AnchoredPopover';

export function AccountMenu({
  identity,
  name,
  save,
}: {
  identity?: { id: string; local: boolean };
  name: string;
  save: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  return (
    <div className="account-menu">
      <Button
        ref={trigger}
        id={menuId + '-trigger'}
        variant="quiet"
        className="account-button"
        compactIcons="keep"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')}
        </span>
        <span>
          <strong>{name}</strong>
          <small>Administrator</small>
        </span>
        <Icon name="more" />
      </Button>
      {open && (
        <AnchoredPopover
          id={menuId}
          className="account-popover"
          label="Account options"
          anchor={trigger}
          onClose={() => setOpen(false)}
        >
          <strong>{name}</strong>
          <p>{identity?.local ? 'Local development' : identity?.id}</p>
          <a className="studio-button quiet" href="/" target="_blank" rel="noopener noreferrer">
            <Icon name="external" />
            View website
          </a>
          <Button
            variant="quiet"
            icon="logout"
            disabled={!identity || identity.local}
            onClick={() => {
              setOpen(false);
              setConfirm(true);
            }}
          >
            Sign out
          </Button>
        </AnchoredPopover>
      )}
      {confirm && (
        <ConfirmDialog
          title="Sign out?"
          confirmLabel="Save & sign out"
          returnFocusTo={trigger.current}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await save();
            window.location.assign('/cdn-cgi/access/logout');
          }}
        >
          <p>
            Your latest changes will be saved before signing out of Cloudflare Access. Your Microsoft account
            stays signed in.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
