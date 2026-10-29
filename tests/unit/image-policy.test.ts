import { expect, it } from 'vitest';
import { ContentSchema } from '@lzzhu/content';
import seed from '../../content/site.json';
import { imageOrigin, previewImageOrigins, studioPolicy } from '../../apps/studio/server/image-policy';
import { app } from '../../apps/studio/server/index';
import type { Env } from '../../apps/studio/server/types';

it('grants only explicit HTTPS image origins; hyperlinks never widen the policy', () => {
  const content = ContentSchema.parse(seed);
  content.pages[0].blocks.push({
    id: 'image',
    version: 1,
    type: 'image',
    src: 'https://images.example.org/photo.jpg',
    alt: '',
    width: 400,
    align: 'center',
    rounded: false,
  });
  content.settings.contacts.push({ label: 'Link', url: 'https://unrelated.example.org/', icon: 'link' });
  const origins = previewImageOrigins(content);
  expect(origins).toContain('https://images.example.org');
  expect(origins).not.toContain('https://unrelated.example.org');
  const policy = studioPolicy(origins);
  expect(policy).toContain("script-src 'self';");
  expect(policy).not.toMatch(/(?:^|\s)https:(?:\s|;)/);
  expect(imageOrigin('https://username:password@images.example.org/')).toBeUndefined();
  expect(imageOrigin('javascript:alert(1)')).toBeUndefined();
  expect(imageOrigin('https://*.example.org/photo.jpg')).toBeUndefined();
  expect(imageOrigin('https://example.org;script-src/photo.jpg')).toBeUndefined();
});

it('isolates a user-selected external thumbnail without server fetching or script permission', async () => {
  const env = { ENVIRONMENT: 'local', LOCAL_DEV_AUTH: '1' } as Env;
  const src = 'https://images.example.org/new.jpg';
  const response = await app.request(
    'http://localhost/admin/image-preview?src=' + encodeURIComponent(src),
    {},
    env,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Security-Policy')).toBe(
    "default-src 'none'; img-src https://images.example.org; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox",
  );
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.text()).toContain('referrerPolicy="no-referrer"');
  for (const source of [
    'http://images.example.org/a.jpg',
    'data:image/svg+xml,x',
    'https://user:secret@example.org/a.jpg',
  ]) {
    const rejected = await app.request(
      'http://localhost/admin/image-preview?src=' + encodeURIComponent(source),
      {},
      env,
    );
    expect(rejected.status).toBe(400);
  }
});
