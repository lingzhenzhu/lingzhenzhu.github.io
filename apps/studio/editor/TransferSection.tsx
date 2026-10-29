import { Button, Pagination } from './controls';
import { usePagination } from './usePagination';
import { moduleDefinitions, moduleCapabilities } from '@lzzhu/content';
import { SharedSourceNotice } from './SharedSourceNotice';
import { useState } from 'react';
import type { CollectionProps } from './types';
import { Dialog, Icon } from './ui';
import { isArchiveView, pageName } from './page-model';
import { copySection, moveSection } from '../../../packages/content/src/operations';
export function TransferSection({
  content,
  change,
  pageId,
  blockId,
  returnFocusTo,
  onClose,
}: CollectionProps & {
  pageId: string;
  blockId: string;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'move' | 'copy'>('move'),
    [targets, setTargets] = useState<string[]>([]),
    [query, search] = useState(''),
    [error, setError] = useState(''),
    [scope, setScope] = useState('pages');
  const pages = content.pages.filter(
    (page) =>
      (mode === 'copy' || page.id !== pageId) &&
      (scope === 'all' || (page.template !== 'article' && !isArchiveView(page))) &&
      (page.title + ' ' + page.path).toLowerCase().includes(query.toLowerCase()),
  );
  const pagination = usePagination(pages.length, `${mode}:${scope}:${query}`);
  const shown = pages.slice(pagination.start, pagination.end);
  const block = content.pages
    .find((page) => page.id === pageId)
    ?.blocks.find((block) => block.id === blockId);
  const source = block && moduleDefinitions[block.type].sharedSource;
  const canCopy = !!block && moduleCapabilities(block.type).copy;
  return (
    <Dialog
      title={canCopy ? 'Move or copy section' : 'Move section'}
      returnFocusTo={returnFocusTo}
      onClose={onClose}
    >
      <div className="writing-modes" aria-label="Transfer action">
        <Button
          data-dialog-focus
          aria-pressed={mode === 'move'}
          onClick={() => {
            setMode('move');
            setTargets([]);
          }}
        >
          <Icon name="move" /> Move
        </Button>
        {canCopy && (
          <Button
            aria-pressed={mode === 'copy'}
            onClick={() => {
              setMode('copy');
              setTargets([]);
            }}
          >
            <Icon name="copy" /> Copy to pages
          </Button>
        )}
      </div>
      <p>
        {mode === 'move'
          ? 'Choose a page. The section will be placed first.'
          : 'Choose pages to receive a copy.'}
      </p>
      {source && <SharedSourceNotice content={content} source={source} />}
      <label>
        Show destinations
        <select
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            setTargets([]);
          }}
        >
          <option value="pages">Website pages</option>
          <option value="all">All pages, including articles and archive views</option>
        </select>
      </label>
      <label>
        Find a destination
        <input type="search" value={query} onChange={(event) => search(event.target.value)} />
      </label>
      {mode === 'copy' && (
        <Button
          compactIcons="keep"
          onClick={() => setTargets([...new Set([...targets, ...shown.map((page) => page.id)])])}
        >
          Select all shown pages
        </Button>
      )}
      <div className="destination-list">
        {shown.map((page) => (
          <label className="check" key={page.id}>
            <input
              type={mode === 'move' ? 'radio' : 'checkbox'}
              name="destination"
              value={page.id}
              checked={targets.includes(page.id)}
              onChange={(event) =>
                setTargets(
                  mode === 'move'
                    ? [page.id]
                    : event.target.checked
                      ? [...targets, page.id]
                      : targets.filter((id) => id !== page.id),
                )
              }
            />
            <Icon name={page.template === 'home' ? 'home' : 'pages'} />
            <span>
              {pageName(page)}
              <small className="muted"> {page.path}</small>
            </span>
          </label>
        ))}
      </div>
      <Pagination {...pagination} />
      {!pages.length && <p className="field-help">No pages match this search.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button compactIcons="keep" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="primary"
          disabled={!targets.length}
          onClick={() => {
            try {
              change((current) =>
                mode === 'move'
                  ? moveSection(current, pageId, blockId, targets[0])
                  : copySection(current, pageId, blockId, targets),
              );
              onClose();
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <Icon name={mode === 'move' ? 'move' : 'copy'} />
          {mode === 'move'
            ? 'Move section'
            : `Copy to ${targets.length} page${targets.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Dialog>
  );
}
