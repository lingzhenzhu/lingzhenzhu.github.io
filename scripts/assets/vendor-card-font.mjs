/** Maintenance command: pin and self-host the OFL font, retaining every supplied glyph.
 * Normal builds only copy these checked-in WOFF2 subsets and never contact Google.
 */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { create } from 'fontkit';
import subsetFont from 'subset-font';
const source = 'https://fonts.gstatic.com/s/notosanstc/v40/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_Co.ttf';
const target = new URL('../../assets/fonts/card/', import.meta.url);
const response = await fetch(source);
if (!response.ok) throw new Error('Font download: ' + response.status);
const input = Buffer.from(await response.arrayBuffer());
const sourceHash = createHash('sha256').update(input).digest('hex');
if (sourceHash !== '619662a0583f38311e92666927e5edbfd30f2a1fbe8593685660bd11bdd46a10')
  throw new Error('Upstream font changed; review its provenance before replacing the pinned assets');
const font = create(input);
if ('fonts' in font) throw new Error('Expected a single font');
await fs.mkdir(target, { recursive: true });
const groups = new Map();
for (const code of font.characterSet.filter((code) => code >= 32)) {
  const start = Math.floor(code / 256) * 256;
  groups.set(start, [...(groups.get(start) || []), code]);
}
let css = '';
for (const [start, points] of [...groups].sort(([a], [b]) => a - b)) {
  const subset = await subsetFont(input, String.fromCodePoint(...points), {
    targetFormat: 'woff2',
    preserveNameIds: [0, 7, 8, 9, 11, 13, 14],
  });
  const hash = createHash('sha256').update(subset).digest('hex').slice(0, 12);
  const filename = `noto-sans-tc-${hash}.woff2`;
  await fs.writeFile(new URL(filename, target), subset);
  css += `@font-face{font-family:"Noto Sans TC";font-style:normal;font-weight:400;font-display:swap;src:url("/assets/fonts/card/${filename}") format("woff2");unicode-range:U+${start.toString(16)}-${(start + 255).toString(16)}}\n`;
}
await fs.writeFile(new URL('card-fonts.css', target), css);
await fs.writeFile(
  new URL('source.json', target),
  JSON.stringify(
    {
      family: 'Noto Sans TC',
      source,
      sha256: sourceHash,
      license: 'SIL Open Font License 1.1',
      subsets: groups.size,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Vendored ${groups.size} Unicode-range subsets; ${font.characterSet.length} glyph mappings.`);
