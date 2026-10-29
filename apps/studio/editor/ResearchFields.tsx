import { Button } from './controls';
import { Icon } from './ui';
import { useRecordSelection } from './useRecordSelection';
import { lazy, Suspense, useState } from 'react';
import { emptyDocument, type Block } from '@lzzhu/content';
import { reorder } from '../../../packages/content/src/operations';
import { ImageField, type ImageTools } from './ImageField';
import { SortableList } from './SortableList';
const RichEditor = lazy(() => import('./RichEditor').then((module) => ({ default: module.RichEditor })));
type Research = Extract<Block, { type: 'research' }>;
export function ResearchFields({
  block,
  update,
  ...tools
}: ImageTools & { block: Research; update: (patch: Partial<Research>) => void }) {
  const { selected, select, rowRef, fallback } = useRecordSelection();
  const part = block.parts.find((item) => item.id === selected);
  const edit = (patch: Record<string, unknown>) =>
    update({
      parts: block.parts.map((item) =>
        item.id === selected ? ({ ...item, ...patch } as typeof item) : item,
      ),
    });
  return (
    <>
      <p className="field-help">Add text and images. Drag to reorder.</p>
      <SortableList
        items={block.parts}
        label="Project content order"
        name={(item) => (item.type === 'image' ? item.alt || 'Image' : 'Text')}
        onMove={(id, to) => update({ parts: reorder(block.parts, id, to) })}
      >
        {(item, index, handle) => (
          <div className="item-row record-row">
            {handle}
            <Button
              compactIcons="keep"
              ref={rowRef(item.id)}
              className="row-link"
              aria-expanded={selected === item.id}
              onClick={() => select(selected === item.id ? '' : item.id)}
            >
              {index + 1}. {item.type === 'image' ? item.alt || 'Image' : 'Text'}
            </Button>
            <Button
              compactIcons="keep"
              aria-label={'Move part up: ' + (index + 1)}
              disabled={!index}
              onClick={() => update({ parts: reorder(block.parts, item.id, index - 1) })}
            >
              ↑
            </Button>
          </div>
        )}
      </SortableList>
      <div className="inline-actions">
        {(['text', 'image'] as const).map((type) => (
          <Button
            compactIcons="keep"
            key={type}
            ref={type === 'text' ? fallback : undefined}
            onClick={() => {
              const id = crypto.randomUUID();
              update({
                parts: [
                  ...block.parts,
                  type === 'text'
                    ? { id, type, document: emptyDocument() }
                    : { id, type, src: '/assets/hsp.svg', alt: '', width: 500 },
                ],
              });
              select(id);
            }}
          >
            Add {type}
          </Button>
        ))}
      </div>
      {part && (
        <fieldset className="record-detail" key={part.id}>
          <legend>Edit {part.type}</legend>
          {part.type === 'image' ? (
            <>
              <ImageField {...tools} src={part.src} alt={part.alt} onChange={edit} />
              <label>
                Display width
                <input
                  type="number"
                  min="16"
                  max="1600"
                  value={part.width}
                  onChange={(e) => edit({ width: Number(e.target.value) })}
                />
              </label>
            </>
          ) : (
            <Suspense fallback={<p>Loading editor…</p>}>
              <RichEditor
                id={part.id}
                document={part.document}
                onChange={(document) => edit({ document })}
                {...tools}
              />
            </Suspense>
          )}
          <Button
            compactIcons="keep"
            className="danger"
            onClick={() => {
              update({ parts: block.parts.filter((item) => item.id !== part.id) });
              select('');
            }}
          >
            Remove {part.type}
          </Button>
          <Button onClick={() => select('')}>
            <Icon name="check" /> Done
          </Button>
        </fieldset>
      )}
      <label>
        Paper link
        <input
          type="url"
          placeholder="https://…"
          value={block.paperUrl || ''}
          onChange={(e) => update({ paperUrl: e.target.value || undefined })}
        />
      </label>
      <label>
        Paper link label
        <input value={block.paperLabel} onChange={(e) => update({ paperLabel: e.target.value })} />
      </label>
    </>
  );
}
