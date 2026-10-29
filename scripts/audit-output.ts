import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { load } from 'cheerio';
import { ContentSchema, publicSnapshot } from '@lzzhu/content';
const directory = path.join(process.cwd(), 'apps/site/dist');
const content = publicSnapshot(
  ContentSchema.parse(
    JSON.parse(await fs.readFile(process.env.SITE_SNAPSHOT || 'content/site.json', 'utf8')),
  ),
);
async function files(folder: string): Promise<string[]> {
  return (
    await Promise.all(
      (await fs.readdir(folder, { withFileTypes: true })).map((entry) =>
        entry.isDirectory() ? files(path.join(folder, entry.name)) : [path.join(folder, entry.name)],
      ),
    )
  ).flat();
}
const all = await files(directory);
const failures: string[] = [];
let maxScript = 0;
let internalLinks = 0;
const anchorCache = new Map<string, Set<string>>();
async function anchors(filename: string) {
  let ids = anchorCache.get(filename);
  if (!ids) {
    const $ = load(await fs.readFile(filename, 'utf8'));
    ids = new Set(
      $('[id]')
        .toArray()
        .map((node) => $(node).attr('id')!),
    );
    anchorCache.set(filename, ids);
  }
  return ids;
}
for (const file of all) {
  const relative = path.relative(directory, file).replaceAll('\\', '/');
  if (
    /(^|\/)(?:admin|server|content|\.env|node_modules)(?:\/|$)/.test(relative) ||
    /\.(map|sql|ts|tsx)$/.test(relative)
  )
    failures.push('Private source in build: ' + relative);
  if (!file.endsWith('.html')) continue;
  const html = await fs.readFile(file, 'utf8');
  const $ = load(html);
  if (gzipSync(html).length > 14_000) failures.push('HTML transfer budget exceeded: ' + relative);
  if (!$('meta[http-equiv="content-security-policy"]').length) failures.push('Missing CSP: ' + relative);
  if (!$('html').attr('lang')) failures.push('Missing page language: ' + relative);
  const pageUrl = new URL('/' + relative.replace(/index\.html$/, ''), 'https://www.lzzhu.net');
  for (const element of $('a[href]').toArray()) {
    const href = $(element).attr('href')!;
    try {
      const target = new URL(href, pageUrl);
      if (target.origin !== pageUrl.origin || /^\/(admin|api)(\/|$)/.test(target.pathname)) continue;
      internalLinks++;
      let targetFile = path.resolve(directory, '.' + decodeURIComponent(target.pathname));
      if (targetFile !== directory && !targetFile.startsWith(directory + path.sep))
        throw new Error('Path escapes the public build');
      if ((await fs.stat(targetFile)).isDirectory()) targetFile = path.join(targetFile, 'index.html');
      await fs.access(targetFile);
      if (
        target.hash &&
        targetFile.endsWith('.html') &&
        !(await anchors(targetFile)).has(decodeURIComponent(target.hash.slice(1)))
      )
        failures.push('Missing anchor: ' + target.pathname + target.hash);
    } catch {
      failures.push('Invalid or broken link in ' + relative + ': ' + href);
    }
  }
  if (/sociablekit|firebase-proxy|hexo|Cf-Access-Jwt|CSRF_SECRET|__reactFiber/i.test(html))
    failures.push('Unexpected runtime in ' + relative);
  for (const script of $('script[src]').toArray()) {
    const src = $(script).attr('src')!;
    if (!src.startsWith('/')) {
      failures.push('External script: ' + src);
      continue;
    }
    const data = await fs.readFile(path.join(directory, src));
    maxScript = Math.max(maxScript, gzipSync(data).length);
  }
  for (const element of $('[src^="/"],link[rel=stylesheet][href^="/"]').toArray()) {
    const url = $(element).attr('src') || $(element).attr('href')!;
    if (url.startsWith('/api/')) continue;
    try {
      await fs.access(path.join(directory, url.split('?')[0]));
    } catch {
      failures.push('Missing asset ' + url + ' in ' + relative);
    }
  }
}
for (const page of content.pages) {
  const filename = path.join(directory, decodeURIComponent(page.path), 'index.html');
  try {
    await fs.access(filename);
  } catch {
    failures.push('Missing page ' + page.path);
  }
}
const homepage = await fs.readFile(path.join(directory, 'index.html'));
if (homepage.length > 14_000) failures.push('Homepage HTML exceeds 14,000 bytes');
if (maxScript > 6_000) failures.push('Public script exceeds 6,000 gzip bytes');
for (const file of all.filter((file) => file.endsWith('.css')))
  if (gzipSync(await fs.readFile(file)).length > 10_000) failures.push('CSS budget exceeded: ' + file);
const sitemap = await fs.readFile(path.join(directory, 'sitemap.xml'), 'utf8');
for (const page of content.pages.filter((page) => !page.indexable)) {
  const html = await fs.readFile(path.join(directory, decodeURIComponent(page.path), 'index.html'), 'utf8');
  if (
    sitemap.includes('https://www.lzzhu.net' + page.path) ||
    !load(html)('meta[name=robots]').attr('content')?.includes('noindex')
  )
    failures.push('Search visibility mismatch for ' + page.path);
}
const report = {
  pages: content.pages.length,
  files: all.length,
  homeHtmlBytes: homepage.length,
  homeHtmlGzipBytes: gzipSync(homepage).length,
  maxScriptGzipBytes: maxScript,
  internalLinks,
};
await fs.mkdir('.artifacts', { recursive: true });
await fs.writeFile('.artifacts/build-audit.json', JSON.stringify(report, null, 2));
console.log(report);
if (failures.length) throw new Error(failures.join('\n'));
