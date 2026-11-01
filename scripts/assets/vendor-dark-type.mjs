// Variable companions provide true half-step dark weights. Non-overlapping face
// declarations keep the original light weights on their static files. All self-hosted.
import fs from 'node:fs/promises';
import subsetFont from 'subset-font';

const revision = '6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec';
const root = new URL('../../assets/fonts/', import.meta.url);
for (const [family, file, target, variationAxes] of [
  ['lora', 'Lora[wght].ttf', 'lora-variable', { wght: { min: 400, max: 500 } }],
  ['jost', 'Jost[wght].ttf', 'jost-variable', { wght: { min: 300, max: 400 } }],
  ['inter', 'Inter[opsz,wght].ttf', 'inter-variable', { wght: { min: 300, max: 700 }, opsz: 14 }],
  [
    'cormorantgaramond',
    'CormorantGaramond[wght].ttf',
    'cormorant-variable',
    { wght: { min: 300, max: 700 } },
  ],
  [
    'cormorantgaramond',
    'CormorantGaramond-Italic[wght].ttf',
    'cormorant-italic-variable',
    { wght: { min: 300, max: 700 } },
  ],
]) {
  const response = await fetch(
    `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/${family}/${encodeURIComponent(file)}`,
  );
  if (!response.ok) throw new Error(`${family}: ${response.status}`);
  const buffer = await subsetFont(Buffer.from(await response.arrayBuffer()), undefined, {
    targetFormat: 'woff2',
    keepAllGlyphs: true,
    variationAxes,
    preserveNameIds: [0, 7, 8, 9, 11, 13, 14],
  });
  await fs.writeFile(new URL(`${target}.woff2`, root), buffer);
  if (family === 'inter' || family === 'cormorantgaramond') {
    const license = await fetch(
      `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/${family}/OFL.txt`,
    );
    if (!license.ok) throw new Error(`${family} license: ${license.status}`);
    await fs.writeFile(new URL(`${family}-OFL.txt`, root), await license.text());
  }
}
