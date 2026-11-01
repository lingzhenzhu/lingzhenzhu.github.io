import { SegmentedControl } from './SegmentedControl';
import { Button, ConfirmDialog } from './controls';
import { useEffect, useRef, useState } from 'react';
import type { Content } from '@lzzhu/content';
import { api, send } from './api';
import type { ReleaseInfo, Revision, RunTask, DraftChange } from './types';
import { EmptyState } from './ui';
export function HistoryPanel({
  local,
  releases,
  revisions,
  run,
  refreshHistory,
  change,
  currentRevision,
  setMessage,
}: {
  local: boolean;
  releases: ReleaseInfo[];
  revisions: Revision[];
  run: RunTask;
  refreshHistory: () => Promise<void>;
  change: DraftChange;
  currentRevision: number;
  setMessage: (value: string) => void;
}) {
  const [tab, setTab] = useState('publications');
  const [restore, setRestore] = useState<{ revision?: number; release?: string }>();
  const pending = useRef<AbortController | null>(null);
  const restoreTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const closeRestore = () => {
    pending.current?.abort();
    pending.current = null;
    setRestore(undefined);
  };
  const date = (value: string) =>
    new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section className="collection history-panel">
      <div className="section-heading">
        <h2>History</h2>
        <div className="button-group">
          <Button compactIcons="keep" onClick={() => run(refreshHistory)}>
            Refresh status
          </Button>
          {!local && (
            <Button
              compactIcons="keep"
              onClick={() =>
                run(async () => {
                  await send('/releases/reconcile', {});
                  await refreshHistory();
                })
              }
            >
              Check live version
            </Button>
          )}
        </div>
      </div>
      <SegmentedControl
        label="History views"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'publications', label: 'Publications' },
          { value: 'drafts', label: 'Draft revisions' },
        ]}
      />
      {tab === 'publications' ? (
        <>
          {!releases.length && (
            <EmptyState title="No publications yet">
              <p>No publications yet.</p>
            </EmptyState>
          )}
          {releases.map((release) => (
            <article className="card release-card" key={release.id}>
              <div className="section-heading">
                <div>
                  <span className={'badge ' + (release.status === 'active' ? 'live' : '')}>
                    {release.status.replaceAll('_', ' ')}
                  </span>
                  <h3>{date(release.created_at)}</h3>
                </div>
                <div className="button-group">
                  {['preparing', 'ready'].includes(release.status) && (
                    <Button
                      compactIcons="keep"
                      onClick={() =>
                        run(async () => {
                          await send('/releases/' + release.id + '/cancel', {});
                          await refreshHistory();
                        })
                      }
                    >
                      Cancel publication
                    </Button>
                  )}
                  {release.artifact_hash && ['active', 'superseded'].includes(release.status) && (
                    <Button
                      compactIcons="keep"
                      onClick={(event) => {
                        restoreTrigger.current = event.currentTarget;
                        setRestore({ release: release.id });
                      }}
                    >
                      Restore publication
                    </Button>
                  )}
                </div>
              </div>
              {release.error && (
                <p className="field-help" role="alert">
                  {release.error}
                </p>
              )}
              <details>
                <summary>Publication details</summary>
                <code>{release.id}</code>
              </details>
            </article>
          ))}
        </>
      ) : (
        <>
          <p className="field-help">Restore a saved draft. Publish when ready.</p>
          {revisions.map((item) => (
            <div className="history-row" key={item.revision}>
              <span>
                <strong>Revision {item.revision}</strong>
                <small>{date(item.created_at)}</small>
              </span>
              <Button
                compactIcons="keep"
                disabled={item.revision === currentRevision}
                onClick={(event) => {
                  restoreTrigger.current = event.currentTarget;
                  setRestore({ revision: item.revision });
                }}
              >
                {item.revision === currentRevision ? 'Current draft' : 'Restore draft'}
              </Button>
            </div>
          ))}
        </>
      )}
      {restore && (
        <ConfirmDialog
          title={restore.release ? 'Restore this publication?' : 'Restore revision ' + restore.revision + '?'}
          onClose={closeRestore}
          confirmLabel="Restore"
          cancelWhileBusy={!restore.release}
          returnFocusTo={restoreTrigger.current}
          onConfirm={async () => {
            if (pending.current) return;
            const request = new AbortController();
            pending.current = request;
            try {
              if (restore.release) {
                await send('/releases/' + restore.release + '/rollback', {});
                await refreshHistory();
              } else {
                const value = await api<Content>('/revisions/' + restore.revision, {
                  signal: request.signal,
                });
                if (request.signal.aborted || pending.current !== request) return;
                change(() => ({ ...value, revision: currentRevision }));
                setMessage('Previous revision loaded into draft');
              }
            } catch (error) {
              if (!request.signal.aborted) throw error;
            } finally {
              if (pending.current === request) pending.current = null;
            }
          }}
        >
          <p>
            {restore.release
              ? 'Publish the selected website version.'
              : 'Replace the current draft with this revision. You can undo it before publishing.'}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
