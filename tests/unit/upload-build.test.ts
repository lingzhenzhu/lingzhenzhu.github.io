import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { buildUploadedImages } from '../../scripts/assets/uploads';

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await fs.rm(folder, { recursive: true, force: true });
});
describe('immutable uploaded image build inputs', () => {
  it('rebuilds identical bytes, strips metadata, never rewrites the source and publishes only referenced files', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'lzzhu-upload-build-'));
    folders.push(folder);
    const originals = path.join(folder, 'private');
    const output = path.join(folder, 'public');
    await fs.mkdir(originals);
    const bytes = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#997854' } })
      .withExif({ IFD0: { Artist: 'Private test metadata' } })
      .jpeg()
      .toBuffer();
    const filename = createHash('sha256').update(bytes).digest('hex') + '.jpg';
    await fs.writeFile(path.join(originals, filename), bytes);
    await fs.writeFile(path.join(originals, 'unreferenced.jpg'), bytes);
    const url = '/assets/uploads/' + filename;
    const first = await buildUploadedImages(JSON.stringify({ src: url }), originals, output);
    const result = await fs.readFile(path.join(output, url));
    const second = await buildUploadedImages(JSON.stringify({ src: url }), originals, output);
    expect(second).toEqual(first);
    expect(await fs.readFile(path.join(output, url))).toEqual(result);
    expect(await fs.readFile(path.join(originals, filename))).toEqual(bytes);
    expect((await sharp(result).metadata()).exif).toBeUndefined();
    expect(await fs.readdir(path.join(output, 'assets/uploads'))).toEqual([filename]);
    for (const variant of first[url].srcset.split(', ')) {
      const source = variant.split(' ')[0];
      const data = await fs.readFile(path.join(output, source));
      expect(path.basename(source, '.webp')).toBe(createHash('sha256').update(data).digest('hex'));
    }
    await fs.writeFile(path.join(originals, filename), Buffer.from('corrupt source'));
    await expect(buildUploadedImages(JSON.stringify({ src: url }), originals, output)).rejects.toThrow(
      'checksum mismatch',
    );
  });
});
