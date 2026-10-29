import { Button, Pagination } from './controls';
import { useState } from 'react';
import { usePagination } from './usePagination';
import type { Asset, RunTask } from './types';
export function MediaLibrary({
  assets,
  run,
  upload,
}: {
  assets: Asset[];
  run: RunTask;
  upload: (file: File) => Promise<string>;
}) {
  const [query, setQuery] = useState(''),
    [copied, setCopied] = useState('');
  const rows = assets.filter((asset) => asset.filename.toLowerCase().includes(query.toLowerCase()));
  const pagination = usePagination(rows.length, query, 24);
  return (
    <div className="collection">
      <h1>Image library</h1>
      <label>
        Search images
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label>
        Upload image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(() => upload(file));
          }}
        />
      </label>
      <div className="asset-grid">
        {rows.slice(pagination.start, pagination.end).map((asset) => (
          <div className="card" key={asset.id}>
            <img src={'/admin/api/assets/' + asset.id} alt="" loading="lazy" />
            <p>{asset.filename}</p>
            <Button
              icon={copied === asset.id ? 'check' : 'copy'}
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText('/assets/uploads/' + asset.id);
                  setCopied(asset.id);
                })
              }
            >
              {copied === asset.id ? 'Copied' : 'Copy image URL'}
            </Button>
          </div>
        ))}
      </div>
      <Pagination {...pagination} />
    </div>
  );
}
