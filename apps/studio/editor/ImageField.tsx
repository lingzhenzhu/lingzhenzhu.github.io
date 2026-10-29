import { Button } from './controls';
import { useEffect, useRef, useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { ImagePreview } from './image-preview';
import type { RunTask } from './types';

export type ImageTools = { run: RunTask; upload: (file: File) => Promise<string> };
export function ImageField({
  src,
  alt,
  onChange,
  run,
  upload,
  logo = false,
  logoHelp = 'Every institution uses a 50 × 50 image with 10 px rounded corners. The full logo is kept inside the frame.',
}: ImageTools & {
  src?: string;
  alt: string;
  onChange: (patch: { src?: string; alt?: string }) => void;
  logo?: boolean;
  logoHelp?: string;
}) {
  const [picking, setPicking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    generation = useRef(0);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const choose = (src: string) => {
    generation.current++;
    onChange({ src });
  };
  return (
    <div className={'image-field ' + (logo ? 'logo-field' : '')}>
      {src && <ImagePreview src={src} alt={alt || 'Selected image'} className="portrait-preview" />}
      <div className="image-field-actions">
        <Button compactIcons="keep" ref={trigger} onClick={() => setPicking(true)}>
          Choose from image library
        </Button>
        <label>
          Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0],
                token = ++generation.current;
              event.target.value = '';
              if (file)
                run(async () => {
                  const result = await upload(file);
                  if (token === generation.current) latestChange.current({ src: result });
                });
            }}
          />
        </label>
      </div>
      {logo && <p className="field-help">{logoHelp}</p>}
      <label>
        Image URL
        <input value={src || ''} onChange={(event) => choose(event.target.value)} />
      </label>
      {!logo && (
        <label>
          Alternative text
          <input value={alt} onChange={(event) => onChange({ alt: event.target.value })} />
        </label>
      )}
      {picking && (
        <ImagePicker returnFocusTo={trigger.current} onClose={() => setPicking(false)} onChoose={choose} />
      )}
    </div>
  );
}
