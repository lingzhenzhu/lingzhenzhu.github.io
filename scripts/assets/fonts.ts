import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import subsetFont from 'subset-font';
import { create as createFont } from 'fontkit';

const digest = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 12);
export async function buildFonts(root: string, output: string, snapshot: string) {
  const directory = path.join(output, 'assets/fonts');
  const designRoot = path.join(root, 'assets/fonts');
  const css = await fs.readFile(path.join(designRoot, 'design-fonts.css'), 'utf8');
  let publicCss = css,
    previewCss = css;
  // Retain Latin alphabets, punctuation and all published glyphs. Private previews use full fonts.
  const glyphs =
    Array.from({ length: 0x250 - 0x20 }, (_, i) => String.fromCodePoint(i + 0x20)).join('') + snapshot;
  for (const match of css.matchAll(/\/assets\/fonts\/([^\s)]+)/g)) {
    const filename = match[1];
    const input = await fs.readFile(path.join(designRoot, filename));
    const subset = await subsetFont(input, glyphs, { targetFormat: 'woff2' });
    const target = filename.replace(/\.woff2$/, '-' + digest(subset) + '.woff2');
    await fs.writeFile(path.join(directory, target), subset);
    publicCss = publicCss.replaceAll(filename, target).replaceAll("format('truetype')", "format('woff2')");
  }
  for (const filename of await fs.readdir(designRoot))
    if (/license|ofl/i.test(filename))
      await fs.copyFile(path.join(designRoot, filename), path.join(directory, filename));
  for (const [family, slug, weights] of [
    ['Inter', 'inter', [300, 400, 500]],
    ['Cormorant Garamond', 'cormorant-garamond', [300, 400, 600]],
  ] as const) {
    for (const weight of weights)
      for (const style of slug === 'inter' ? ['normal'] : ['normal', 'italic']) {
        if (style === 'italic' && weight === 600) continue;
        const filename = `${slug}-latin-${weight}-${style}.woff2`;
        await fs.copyFile(
          path.join(root, 'node_modules/@fontsource', slug, 'files', filename),
          path.join(directory, filename),
        );
        const rule = `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url("/assets/fonts/${filename}") format("woff2")}\n`;
        publicCss += rule;
        previewCss += rule;
      }
    await fs.copyFile(
      path.join(root, 'node_modules/@fontsource', slug, 'LICENSE'),
      path.join(directory, slug + '-LICENSE.txt'),
    );
  }
  const chinese = await fs.readFile(path.join(root, 'assets/source/lanting.woff2'));
  const font = createFont(chinese);
  if ('fonts' in font) throw new Error('Expected a single Chinese font');
  const codepoints = [...new Set([...snapshot].map((character) => character.codePointAt(0)!))]
    .filter((codepoint) => font.hasGlyphForCodePoint(codepoint))
    .sort((a, b) => a - b);
  for (let offset = 0; offset < codepoints.length; offset += 256) {
    const group = codepoints.slice(offset, offset + 256);
    const subset = await subsetFont(chinese, String.fromCodePoint(...group), {
      targetFormat: 'woff2',
      preserveNameIds: [0, 7, 8, 9, 11, 13, 14],
    });
    const filename = 'lanting-' + digest(subset) + '.woff2';
    await fs.writeFile(path.join(directory, filename), subset);
    publicCss += `@font-face{font-family:lanting;font-weight:300;font-display:swap;src:url("/assets/fonts/${filename}") format("woff2");unicode-range:${group.map((value) => 'U+' + value.toString(16)).join(',')}}\n`;
  }
  await fs.writeFile(path.join(output, 'assets/fonts.css'), publicCss);
  return { chinese, previewCss };
}
