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
        // oxlint-disable-next-line no-control-regex -- strips control characters from file names
        .replace(/[\u0000-\u001f\u007f]/g, ''),
    )
      .slice(0, 200)
      .join('') || 'image'
  );
}

type AssetRow = { id: string; key: string; width: number | null; height: number | null };
// Assets uploaded before sizes were recorded are measured a few at a time, then kept.
const BACKFILL_PER_REQUEST = 12;

export const assets = new Hono<AppEnv>();
assets.get('/', async (c) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM assets ORDER BY created_at DESC LIMIT 500').all<AssetRow>())
    .results;
  for (const row of rows.filter((row) => row.width == null).slice(0, BACKFILL_PER_REQUEST)) {
    const object = await c.env.PRIVATE.get(row.key);
    if (!object) continue;
    try {
      const info = await c.env.IMAGES.info(object.body);
      if (!('width' in info)) continue;
      await c.env.DB.prepare('UPDATE assets SET width=?, height=? WHERE id=?')
        .bind(info.width, info.height, row.id)
        .run();
      Object.assign(row, { width: info.width, height: info.height });
    } catch {
      // A size is an optimisation; the asset itself stays listed and usable.
    }
  }
  return c.json(rows);
});

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

  let extension: string, width: number, height: number;
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
    ({ width, height } = info);
  } catch (error) {
    console.warn('Image decoding failed', error instanceof Error ? error.message : 'Unknown error');
    return c.json({ error: 'This image could not be decoded. Export it again as JPEG, PNG or WebP.' }, 400);
  }
  const id = (await sha256(body)) + '.' + extension;
  const mime = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension;
  // Keep the full resolution original. Content addressing makes retried uploads idempotent.
  await c.env.PRIVATE.put('assets/' + id, body, { httpMetadata: { contentType: mime } });
  await c.env.DB.prepare(
    // Content addressing: a repeat upload keeps the first record and only fills in a missing size.
    'INSERT INTO assets(id,key,mime,size,filename,created_at,width,height) VALUES(?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT(id) DO UPDATE SET width=coalesce(width,excluded.width), height=coalesce(height,excluded.height)',
  )
    .bind(id, 'assets/' + id, mime, body.byteLength, filename, new Date().toISOString(), width, height)
    .run();
  return c.json({ id, src: '/assets/uploads/' + id, preview: '/admin/api/assets/' + id, width, height });
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
