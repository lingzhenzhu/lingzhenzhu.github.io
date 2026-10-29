import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { createElement } from 'react';
import { build } from 'esbuild';
import { buildFonts } from './assets/fonts';
import { optimizeEmbeddedImages } from './assets/svg';
import { buildUploadedImages } from './assets/uploads';
import { preferencesBootstrap } from '../packages/presentation/src/behavior/bootstrap';
import { ContentSchema, publicSnapshot } from '@lzzhu/content';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'apps/site/public');
const studioDir = path.join(root, 'apps/studio/public');
// Both public directories are generated output. Originals stay in private release staging.
for (const folder of [publicDir, studioDir]) {
  const resolved = path.resolve(folder);
  if (!resolved.startsWith(root + path.sep) || !resolved.endsWith(path.sep + 'public'))
    throw new Error('Unsafe generated asset directory');
  await fs.mkdir(folder, { recursive: true });
  for (const entry of await fs.readdir(folder))
    await fs.rm(path.join(folder, entry), { recursive: true, force: true });
}
await fs.mkdir(path.join(publicDir, 'assets/og'), { recursive: true });
await fs.mkdir(path.join(publicDir, 'assets/fonts'), { recursive: true });
await fs.mkdir(studioDir, { recursive: true });
const write = (name: string, value: string | Buffer) => fs.writeFile(path.join(publicDir, name), value);
await write('CNAME', 'www.lzzhu.net\n');
await write('.nojekyll', '');
const content = publicSnapshot(
  ContentSchema.parse(
    JSON.parse(await fs.readFile(process.env.SITE_SNAPSHOT || path.join(root, 'content/site.json'), 'utf8')),
  ),
);
const snapshotJson = JSON.stringify(content);
const { chinese, previewCss } = await buildFonts(root, publicDir, snapshotJson);
await write('assets/medium-public.json', JSON.stringify(content.medium));
await write('assets/preferences.js', preferencesBootstrap);
const imageManifest: Record<string, { width: number; height: number; srcset?: string }> = {};
for (const entry of await fs.readdir(path.join(root, 'assets/source'))) {
  const source = path.join(root, 'assets/source', entry);
  if (entry.endsWith('.svg')) {
    const { width, height } = await sharp(source).metadata();
    if (!width || !height) throw new Error('SVG needs intrinsic dimensions: ' + entry);
    imageManifest['/assets/' + entry] = { width, height };
    await write('assets/' + entry, await optimizeEmbeddedImages(await fs.readFile(source, 'utf8')));
    continue;
  }
  if (!/\.(jpg|png|webp)$/.test(entry)) continue;
  const image = sharp(source);
  const metadata = await image.metadata();
  await fs.copyFile(source, path.join(publicDir, 'assets', entry));
  const sizes = [
    ...new Set(
      [110, 220, 330, 500, 1000, 1500, metadata.width!].filter(
        (width) => width <= metadata.width! && (entry !== 'avatar.jpg' || width >= 220),
      ),
    ),
  ];
  const variants: string[] = [];
  for (const width of sizes) {
    const filename = entry.replace(/\.\w+$/, '') + '-' + width + '.webp';
    await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(path.join(publicDir, 'assets', filename));
    variants.push('/assets/' + filename + ' ' + width + 'w');
  }
  imageManifest['/assets/' + entry] = {
    width: metadata.width!,
    height: metadata.height!,
    srcset: variants.join(', '),
  };
}
Object.assign(
  imageManifest,
  await buildUploadedImages(
    snapshotJson,
    process.env.SITE_UPLOADS || path.join(root, '.artifacts/release/uploads'),
    publicDir,
  ),
);
await fs.writeFile(
  path.join(root, 'packages/presentation/src/assets.json'),
  JSON.stringify(imageManifest, null, 2),
);
const favicon = await fs.readFile(path.join(root, 'assets/source/favicon.svg'), 'utf8');
await write('assets/favicon.svg', favicon);
await sharp(Buffer.from(favicon)).resize(32).png().toFile(path.join(publicDir, 'assets/favicon-32.png'));
await sharp(Buffer.from(favicon))
  .resize(180)
  .png()
  .toFile(path.join(publicDir, 'assets/apple-touch-icon.png'));
const font = await fs.readFile(
  path.join(
    root,
    'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff',
  ),
);
for (const page of content.pages) {
  const svg = await satori(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          color: '#3a2e20',
          background: '#fafaf8',
          fontFamily: 'Cormorant, Chinese',
        },
      },
      createElement(
        'div',
        { style: { fontSize: 24, letterSpacing: 6, marginBottom: 40 } },
        content.settings.author.toUpperCase(),
      ),
      createElement('div', { style: { fontSize: 60, lineHeight: 1.15 } }, page.title.slice(0, 120)),
      createElement('div', { style: { fontSize: 22, marginTop: 55, color: '#8b7355' } }, 'www.lzzhu.net'),
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Cormorant', data: font, weight: 400 },
        { name: 'Chinese', data: chinese, weight: 400 },
      ],
    },
  );
  await write('assets/og/' + page.id + '.png', new Resvg(svg).render().asPng());
}
await write(
  'robots.txt',
  'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://www.lzzhu.net/sitemap.xml\n',
);
const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
await write(
  'sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    content.pages
      .filter((page) => page.indexable)
      .map((page) => '<url><loc>' + escape('https://www.lzzhu.net' + page.path) + '</loc></url>')
      .join('') +
    '</urlset>',
);
await fs.cp(path.join(publicDir, 'assets'), path.join(studioDir, 'assets'), { recursive: true });
for (const entry of await fs.readdir(path.join(root, 'assets/fonts')))
  if (entry.endsWith('.woff2'))
    await fs.copyFile(path.join(root, 'assets/fonts', entry), path.join(studioDir, 'assets/fonts', entry));
// Drafts may contain new glyphs absent from the current published font subsets.
// The full preview font stays behind Access and is never part of the public build.
await fs.mkdir(path.join(studioDir, 'fonts'), { recursive: true });
await fs.writeFile(path.join(studioDir, 'fonts/lanting.woff2'), chinese);
await fs.writeFile(
  path.join(studioDir, 'assets/fonts.css'),
  previewCss.replaceAll('/assets/fonts/', '/admin/assets/fonts/'),
);
await build({
  entryPoints: [path.join(root, 'packages/presentation/src/behavior/index.ts')],
  outfile: path.join(studioDir, 'runtime.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
});
await build({
  entryPoints: [path.join(root, 'packages/presentation/src/styles/index.css')],
  outfile: path.join(studioDir, 'site.css'),
  bundle: true,
  minify: true,
});
console.log(
  'Built local fonts, image variants, public metadata, ' +
    content.pages.length +
    ' OG images and shared preview assets.',
);
