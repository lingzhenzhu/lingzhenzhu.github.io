import { Button, Pagination } from './controls';
import { usePagination } from './usePagination';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Asset } from './types';
import { Dialog, EmptyState, Icon } from './ui';
import { ImagePreview } from './image-preview';
const builtInImages = [
  { id: 'logo', filename: 'ZH monogram', src: '/assets/logo.svg' },
  { id: 'avatar', filename: 'Portrait', src: '/assets/avatar.jpg' },
  { id: 'uva', filename: 'University of Virginia', src: '/assets/uva.jpg' },
  { id: 'hsp', filename: 'Research illustration', src: '/assets/hsp.svg' },
  { id: 'card', filename: 'Request card illustration', src: '/assets/card.jpg' },
];

export function ImagePicker({
  onChoose,
  onClose,
  returnFocusTo,
  upload,
}: {
  onChoose: (src: string) => void;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
  upload?: (file: File) => Promise<string>;
}) {
  const [assets, setAssets] = useState<Asset[]>(),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [uploading, setUploading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Asset[]>('/assets', { signal: controller.signal })
      .then(setAssets)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);
  const filtered = [
    ...builtInImages,
    ...(assets || []).map((asset) => ({ ...asset, src: '/assets/uploads/' + asset.id })),
  ].filter((asset) => asset.filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pagination = usePagination(filtered.length, query, 24);
  return (
    <Dialog title="Choose an image" onClose={onClose} returnFocusTo={returnFocusTo} dismissible={!uploading}>
      {upload && (
        <label className="picker-upload">
          <span>
            <Icon name="publish" /> Upload a new image
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setUploading(true);
              setError('');
              try {
                const src = await upload(file);
                onChoose(src);
                onClose();
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      )}
      {uploading && <p role="status">Uploading image…</p>}
      <label>
        Search images
        <input
          autoFocus
          data-dialog-focus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {!assets && !error && <p role="status">Loading images…</p>}
      {filtered?.length === 0 && <EmptyState title="No matching images" />}
      <div className="asset-grid">
        {filtered.slice(pagination.start, pagination.end).map((asset) => (
          <Button
            compactIcons="keep"
            disabled={uploading}
            key={asset.id}
            className="card"
            onClick={() => {
              onChoose(asset.src);
              onClose();
            }}
          >
            <ImagePreview src={asset.src} alt="" />
            <span>{asset.filename}</span>
          </Button>
        ))}
      </div>
      <Pagination {...pagination} />
    </Dialog>
  );
}
