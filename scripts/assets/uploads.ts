import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function referencedUploads(snapshot: string) {
  return [...new Set(snapshot.match(/\/assets\/uploads\/[a-f0-9]{64}\.(?:jpg|png|webp)/g) || [])];
}

/** Original files are immutable build inputs, kept outside both public asset trees. */
export async function buildUploadedImages(snapshot: string, originals: string, publicDir: string) {
  const manifest: Record<string, { width: number; height: number; srcset: string }> = {};
  const uploads = path.join(publicDir, 'assets/uploads');
  const derived = path.join(publicDir, 'assets/derived');
  await fs.mkdir(uploads, { recursive: true });
  await fs.mkdir(derived, { recursive: true });
  for (const url of referencedUploads(snapshot)) {
    const filename = path.basename(url);
    const original = await fs.readFile(path.join(originals, filename));
    if (digest(original) !== filename.split('.')[0])
      throw new Error('Uploaded source checksum mismatch: ' + filename);
    const normalized = await sharp(original, { limitInputPixels: 32_000_000 })
      .rotate()
      .toFormat(filename.endsWith('.png') ? 'png' : filename.endsWith('.webp') ? 'webp' : 'jpeg', {
        quality: 95,
      })
      .toBuffer({ resolveWithObject: true });
    await fs.writeFile(path.join(uploads, filename), normalized.data);
    const { width, height } = normalized.info;
    const variants: string[] = [];
    for (const size of [...new Set([220, 330, 500, 1000, 1500, width].filter((size) => size <= width))]) {
      const bytes = await sharp(normalized.data)
        .resize({ width: size, withoutEnlargement: true })
        .webp({ quality: 92 })
        .toBuffer();
      const output = digest(bytes) + '.webp';
      await fs.writeFile(path.join(derived, output), bytes);
      variants.push('/assets/derived/' + output + ' ' + size + 'w');
    }
    manifest[url] = { width, height, srcset: variants.join(', ') };
  }
  return manifest;
}
