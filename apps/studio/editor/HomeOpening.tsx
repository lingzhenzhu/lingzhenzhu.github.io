import { Select } from './Select';
import { Button } from './controls';
import { useEffect, useRef, useState } from 'react';
import { ImagePicker } from './ImagePicker';
import { ImageUpload } from './ImageUpload';
import { FormSection } from './FormSection';
import type { Page } from '@lzzhu/content';
import type { CollectionProps } from './types';
export function HomeOpening({
  content,
  change,
  page,
  update,
  upload,
}: CollectionProps & {
  page: Page;
  update: (patch: Partial<Page>) => void;
  upload: (file: File) => Promise<string>;
}) {
  const hero = page.homeHero || { nameNote: '' };
  const uploadGeneration = useRef(0);
  const [picking, setPicking] = useState(false);
  const imageTrigger = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      uploadGeneration.current++;
    },
    [],
  );
  return (
    <>
      <h2>Homepage opening</h2>
      <label>
        English name
        <input value={page.title} onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label>
        Chinese name
        <input
          value={hero.nameNote}
          onChange={(e) => update({ homeHero: { ...hero, nameNote: e.target.value } })}
        />
      </label>
      <FormSection title="Opening image">
        <p className="field-help">An optional image below the name.</p>
        <Select
          aria-label="Opening image"
          value={hero.image?.source || 'none'}
          onChange={(e) => {
            uploadGeneration.current++;
            update({
              homeHero: {
                ...hero,
                image:
                  e.target.value === 'none'
                    ? undefined
                    : e.target.value === 'profile'
                      ? { source: 'profile' }
                      : { source: 'custom', src: '/assets/avatar.jpg', alt: content.settings.author },
              },
            });
          }}
        >
          <option value="none">No image</option>
          <option value="profile" disabled={!page.blocks.some((b) => b.type === 'profile')}>
            Move homepage portrait here
          </option>
          <option value="custom">Use a separate portrait</option>
        </Select>
        {hero.image?.source === 'profile' && (
          <p className="field-help">
            Uses the Portrait section’s photo and removes its duplicate below the opening.
          </p>
        )}
        {hero.image?.source === 'custom' && (
          <>
            <div className="image-field-actions">
              <Button icon="image" compactIcons="keep" ref={imageTrigger} onClick={() => setPicking(true)}>
                Choose from image library
              </Button>
              <ImageUpload
                label="Upload opening portrait"
                onUpload={async (file) => {
                  const generation = ++uploadGeneration.current;
                  const src = await upload(file);
                  if (generation !== uploadGeneration.current) return;
                  change((c) => ({
                    ...c,
                    pages: c.pages.map((p) => {
                      const latest = p.homeHero;
                      if (p.id !== page.id || latest?.image?.source !== 'custom') return p;
                      return { ...p, homeHero: { ...latest, image: { ...latest.image, src } } };
                    }),
                  }));
                }}
              />
            </div>
            {picking && (
              <ImagePicker
                returnFocusTo={imageTrigger.current}
                onClose={() => setPicking(false)}
                onChoose={(src) => {
                  uploadGeneration.current++;
                  change((content) => ({
                    ...content,
                    pages: content.pages.map((item) =>
                      item.id === page.id && item.homeHero?.image?.source === 'custom'
                        ? { ...item, homeHero: { ...item.homeHero, image: { ...item.homeHero.image, src } } }
                        : item,
                    ),
                  }));
                }}
              />
            )}
            <label>
              Image URL
              <input
                value={hero.image.src}
                onChange={(e) => {
                  uploadGeneration.current++;
                  update({
                    homeHero: {
                      ...hero,
                      image: {
                        ...(hero.image as Extract<NonNullable<typeof hero.image>, { source: 'custom' }>),
                        src: e.target.value,
                      },
                    },
                  });
                }}
              />
            </label>
            <label>
              Alternative text
              <input
                value={hero.image.alt}
                onChange={(e) =>
                  update({
                    homeHero: {
                      ...hero,
                      image: {
                        ...(hero.image as Extract<NonNullable<typeof hero.image>, { source: 'custom' }>),
                        alt: e.target.value,
                      },
                    },
                  })
                }
              />
            </label>
          </>
        )}
      </FormSection>
    </>
  );
}
