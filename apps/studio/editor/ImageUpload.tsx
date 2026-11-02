import { useId, useRef, useState } from 'react';
import { Button } from './Button';

/** One upload control for image fields, the library and the notebook picker. */
export function ImageUpload({
  onUpload,
  label = 'Upload image',
  onBusyChange,
}: {
  onUpload: (file: File) => Promise<unknown>;
  label?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    id = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  return (
    <div className="image-upload">
      <input
        ref={input}
        type="file"
        hidden
        aria-label={label}
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setError('');
          setBusy(true);
          setStatus('Uploading ' + file.name);
          onBusyChange?.(true);
          try {
            await onUpload(file);
            setStatus('Uploaded ' + file.name);
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Upload failed. Try again.');
            setStatus('');
          } finally {
            setBusy(false);
            onBusyChange?.(false);
          }
        }}
      />
      <Button
        icon="publish"
        compactIcons="keep"
        busy={busy}
        aria-describedby={error ? id : undefined}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : label}
      </Button>
      <span className="sr-only" role="status">
        {status}
      </span>
      {error && (
        <p id={id} className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
