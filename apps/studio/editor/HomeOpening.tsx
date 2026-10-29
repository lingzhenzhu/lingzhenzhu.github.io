import { Button } from './controls';
import { useEffect, useRef, useState } from 'react';
import { ImagePicker } from './ImagePicker';
import type { Page } from '@lzzhu/content';
import type { CollectionProps, RunTask } from './types';
export function HomeOpening({
  content,
  change,
  page,
  update,
  run,
  upload,
}: CollectionProps & {
  page: Page;
  update: (patch: Partial<Page>) => void;
  run: RunTask;
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
      <fieldset>
        <legend>Opening image</legend>
        <p className="field-help">Optional image below your name.</p>
        <select
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
        </select>
        {hero.image?.source === 'profile' && (
          <p className="field-help">
            Uses the Portrait section’s photo and removes its duplicate below the opening.
          </p>
        )}
        {hero.image?.source === 'custom' && (
          <>
            <Button compactIcons="keep" ref={imageTrigger} onClick={() => setPicking(true)}>
              Choose from image library
            </Button>
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
              Upload opening portrait
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const generation = ++uploadGeneration.current;
                  if (file)
                    run(async () => {
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
      </fieldset>
    </>
  );
}
