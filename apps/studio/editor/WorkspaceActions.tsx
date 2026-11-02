import { Button, StatusMessage } from './controls';

export function WorkspaceActions({
  message,
  error,
  ready,
  canUndo,
  canRedo,
  undo,
  redo,
  save,
  review,
}: {
  message: string;
  error: string;
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  save: () => void;
  review: () => void;
}) {
  return (
    <header className="top-actions" aria-label="Draft actions">
      <StatusMessage
        tone={
          error
            ? 'error'
            : message === 'Saving…'
              ? 'busy'
              : message === 'All changes saved'
                ? 'success'
                : 'neutral'
        }
      >
        {message}
      </StatusMessage>
      <div className="history-actions" data-glass="clear" role="group" aria-label="Draft history">
        <Button
          variant="quiet"
          compactIcons="keep"
          className="icon-button"
          icon="undo"
          aria-label="Undo change"
          disabled={!canUndo}
          onClick={undo}
        />
        <Button
          variant="quiet"
          compactIcons="keep"
          className="icon-button"
          icon="redo"
          aria-label="Redo change"
          disabled={!canRedo}
          onClick={redo}
        />
      </div>
      <Button icon="check" compactIcons="keep" compactLabel title="Save" onClick={save} disabled={!ready}>
        Save
      </Button>
      <Button icon="publish" compactIcons="keep" compactLabel title="Review & publish" variant="primary" onClick={review} disabled={!ready}>
        Review & publish
      </Button>
    </header>
  );
}
