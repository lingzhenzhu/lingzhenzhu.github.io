import { Hono } from 'hono';
import { sha256, type AppEnv } from './types';
import { completeImageContainer } from './image-container';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 32_000_000;

export function imageFilename(header = 'image'): string {
  // Decode before shortening: percent escapes and surrogate pairs are not characters.
  return (
    Array.from(
      decodeURIComponent(header)
        .normalize('NFC')
        .replace(/[\u0000-\u001f\u007f]/g, ''),
    )
      .slice(0, 200)
      .join('') || 'image'
  );
}

export const assets = new Hono<AppEnv>();
assets.get('/', async (c) =>
  c.json((await c.env.DB.prepare('SELECT * FROM assets ORDER BY created_at DESC LIMIT 500').all()).results),
);

assets.post('/', async (c) => {
  const body = await c.req.arrayBuffer();
  if (body.byteLength > MAX_BYTES || body.byteLength < 12)
    return c.json({ error: 'Choose a complete image smaller than 8 MiB.' }, 400);
  let filename: string;
  if (!completeImageContainer(new Uint8Array(body)))
    return c.json({ error: 'This image is incomplete or damaged. Export it again before uploading.' }, 400);
  try {
    filename = imageFilename(c.req.header('X-Filename'));
  } catch {
    return c.json({ error: 'The image filename is not valid UTF-8.' }, 400);
  }

  let extension: string;
  try {
    const stream = () => new Blob([body]).stream();
    const info = await c.env.IMAGES.info(stream());
    if (!('width' in info) || !['image/jpeg', 'image/png', 'image/webp'].includes(info.format))
      return c.json({ error: 'Choose a JPEG, PNG or WebP image.' }, 400);
    if (info.width * info.height > MAX_PIXELS || Math.max(info.width, info.height) > 8192)
      return c.json({ error: 'Choose an image up to 32 megapixels and 8,192 pixels per side.' }, 400);
    // Metadata alone does not prove that the compressed pixel data can be decoded.
    const decoded = await c.env.IMAGES.input(stream())
      .transform({ width: 1, height: 1 })
      .output({ format: 'image/png' });
    await decoded.response().arrayBuffer();
    extension = info.format === 'image/jpeg' ? 'jpg' : info.format.slice('image/'.length);
  } catch (error) {
    console.warn('Image decoding failed', error instanceof Error ? error.message : 'Unknown error');
    return c.json({ error: 'This image could not be decoded. Export it again as JPEG, PNG or WebP.' }, 400);
  }
  const id = (await sha256(body)) + '.' + extension;
  const mime = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension;
  // Keep the full resolution original. Content addressing makes retried uploads idempotent.
  await c.env.PRIVATE.put('assets/' + id, body, { httpMetadata: { contentType: mime } });
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO assets(id,key,mime,size,filename,created_at) VALUES(?,?,?,?,?,?)',
  )
    .bind(id, 'assets/' + id, mime, body.byteLength, filename, new Date().toISOString())
    .run();
  return c.json({ id, src: '/assets/uploads/' + id, preview: '/admin/api/assets/' + id });
});

assets.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(id)) return c.notFound();
  const object = await c.env.PRIVATE.get('assets/' + id);
  return object
    ? new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    : c.notFound();
});
