import { Button } from './controls';
import { useEffect, useRef, useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { ImageUpload } from './ImageUpload';
import { ImagePreview } from './image-preview';

export type ImageTools = { upload: (file: File) => Promise<string> };
export function ImageField({
  src,
  alt,
  onChange,
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
        <Button icon="image" compactIcons="keep" ref={trigger} onClick={() => setPicking(true)}>
          Choose from image library
        </Button>
        <ImageUpload
          onUpload={async (file) => {
            const token = ++generation.current;
            const result = await upload(file);
            if (token === generation.current) latestChange.current({ src: result });
          }}
        />
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
