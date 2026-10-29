import { Button } from './controls';
import React, { useEffect, useState } from 'react';
import { api, send } from './api';
import { ConfirmDialog } from './controls';
import { Icon } from './icons';
type State = {
  remaining: number;
  revision: number;
  requests: { id: string; text: string; created_at: string }[];
};
export function Rewards() {
  const [state, setState] = useState<State>();
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState<HTMLElement | null>(null);
  const run = (task: () => Promise<State>) => {
    setError('');
    task()
      .then((data) => {
        setState(data);
        setAmount(data.remaining);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    run(() => api('/rewards'));
  }, []);
  return (
    <div className="collection">
      <h1>
        <Icon name="cloudflare" /> Request card
      </h1>
      <p>
        Cloudflare · Manage the protected card here. The existing Firebase card has its own administrator
        login on the card page.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button compactIcons="keep" onClick={() => run(() => api('/rewards'))}>
        Refresh
      </Button>
      {state && (
        <>
          <p>Remaining requests: {state.remaining}</p>
          <label>
            Set available requests
            <input
              type="number"
              min="0"
              max="100000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <Button
            compactIcons="keep"
            onClick={() =>
              run(() => send('/rewards', { remaining: amount, expectedRevision: state.revision }, 'PUT'))
            }
          >
            Save balance
          </Button>
          <h2>Request history</h2>
          {state.requests.map((item) => (
            <article className="card" key={item.id}>
              <p>{item.text}</p>
              <time>{item.created_at}</time>
            </article>
          ))}
          <Button
            compactIcons="keep"
            className="danger"
            onClick={(event) => setClearing(event.currentTarget)}
          >
            Clear request history
          </Button>
          {clearing && (
            <ConfirmDialog
              title="Clear request history?"
              confirmLabel="Clear history"
              destructive
              returnFocusTo={clearing}
              onClose={() => setClearing(null)}
              onConfirm={async () => {
                const data = await send<State>('/rewards/requests', {}, 'DELETE');
                setState(data);
                setAmount(data.remaining);
              }}
            >
              <p>This permanently deletes all request history. The available balance will stay the same.</p>
            </ConfirmDialog>
          )}
        </>
      )}
    </div>
  );
}
