import { Button } from './controls';
import { Icon } from './ui';
import { useRecordSelection } from './useRecordSelection';
import { useRef, useState } from 'react';
import type { Block } from '@lzzhu/content';
import { reorder } from '../../../packages/content/src/operations';
import { ImageField, type ImageTools } from './ImageField';
import { ImagePicker } from './ImagePicker';
import { ImagePreview } from './image-preview';
import { SortableList } from './SortableList';
type Gallery = Extract<Block, { type: 'gallery' }>;
export function GalleryFields({
  block,
  update,
  ...tools
}: ImageTools & { block: Gallery; update: (patch: Partial<Gallery>) => void }) {
  const [picking, pick] = useState(false);
  const { selected, select, rowRef, fallback } = useRecordSelection();
  const trigger = useRef<HTMLButtonElement>(null);
  const photo = block.photos.find((item) => item.id === selected);
  return (
    <>
      <p className="field-help">
        Choose images, then select a photo to edit its description. Drag the handles to arrange the sequence.
      </p>
      <SortableList
        items={block.photos}
        label="Photo order"
        name={(item) => item.alt || 'Photo'}
        onMove={(id, to) => update({ photos: reorder(block.photos, id, to) })}
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
              <ImagePreview src={item.src} alt="" className="record-thumbnail" />
              <span>
                {index + 1}. {item.alt || 'Untitled photo'}
              </span>
            </Button>
            <Button
              compactIcons="keep"
              aria-label={'Move photo up: ' + (index + 1)}
              disabled={!index}
              onClick={() => update({ photos: reorder(block.photos, item.id, index - 1) })}
            >
              <Icon name="up" />
            </Button>
          </div>
        )}
      </SortableList>
      <Button
        ref={(element) => {
          trigger.current = element;
          fallback.current = element;
        }}
        onClick={() => pick(true)}
      >
        <Icon name="image" /> Add photo
      </Button>
      {picking && (
        <ImagePicker
          upload={tools.upload}
          returnFocusTo={trigger.current}
          onClose={() => pick(false)}
          onChoose={(src) => {
            const id = crypto.randomUUID();
            update({ photos: [...block.photos, { id, src, alt: '', caption: '' }] });
            select(id);
          }}
        />
      )}
      {photo && (
        <fieldset className="record-detail" key={photo.id}>
          <legend>Edit photo</legend>
          <ImageField
            {...tools}
            src={photo.src}
            alt={photo.alt}
            onChange={(patch) =>
              update({
                photos: block.photos.map((item) => (item.id === photo.id ? { ...item, ...patch } : item)),
              })
            }
          />
          <label>
            Caption
            <input
              value={photo.caption}
              onChange={(e) =>
                update({
                  photos: block.photos.map((item) =>
                    item.id === photo.id ? { ...item, caption: e.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <Button
            className="danger"
            onClick={() => {
              update({ photos: block.photos.filter((item) => item.id !== photo.id) });
              select('');
            }}
          >
            <Icon name="trash" /> Remove photo
          </Button>
          <Button onClick={() => select('')}>
            <Icon name="check" /> Done
          </Button>
        </fieldset>
      )}
      <fieldset className="gallery-playback">
        <legend>Playback</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={block.autoplay}
            onChange={(e) => update({ autoplay: e.target.checked })}
          />
          Automatic slideshow
        </label>
        <label>
          Seconds per photo
          <input
            type="number"
            min="4"
            max="60"
            disabled={!block.autoplay}
            value={block.interval / 1000}
            onChange={(e) => update({ interval: Number(e.target.value) * 1000 })}
          />
        </label>
        <p className="field-help">
          Visitors can pause at any time. Reduced-motion preferences disable automatic playback.
        </p>
      </fieldset>
    </>
  );
}
