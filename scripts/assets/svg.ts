import sharp from 'sharp';

/** Preserve vectors and dimensions; compress embedded raster pixels losslessly. */
export async function optimizeEmbeddedImages(svg: string): Promise<string> {
  const matches = [...svg.matchAll(/data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=\s]+)(?=["'])/g)];
  for (const match of matches) {
    const input = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
    const output = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer();
    const replacement = 'data:image/webp;base64,' + output.toString('base64');
    if (replacement.length < match[0].length) svg = svg.replace(match[0], replacement);
  }
  return svg;
}
