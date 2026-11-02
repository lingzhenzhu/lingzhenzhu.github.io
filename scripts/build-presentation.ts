import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { preferencesBootstrap } from '@lzzhu/presentation/bootstrap';

/** One build entry for public behavior and authenticated live-preview assets. */
export async function buildPresentation() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const site = path.join(root, 'apps/site/public');
  const studio = path.join(root, 'apps/studio/public');
  await Promise.all([site, studio].map((dir) => fs.mkdir(path.join(dir, 'assets'), { recursive: true })));
  await build({
    entryPoints: [path.join(root, 'packages/presentation/src/behavior/article-search.ts')],
    outfile: path.join(site, 'assets/article-search.js'),
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
  });
  await fs.copyFile(
    path.join(site, 'assets/article-search.js'),
    path.join(studio, 'assets/article-search.js'),
  );
  await Promise.all(
    [site, studio].map((dir) => fs.writeFile(path.join(dir, 'assets/preferences.js'), preferencesBootstrap)),
  );
  await build({
    entryPoints: [path.join(root, 'packages/presentation/src/behavior/index.ts')],
    outfile: path.join(studio, 'runtime.js'),
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
  });
  await build({
    entryPoints: [path.join(root, 'packages/presentation/src/styles/index.css')],
    outfile: path.join(studio, 'site.css'),
    bundle: true,
    minify: true,
  });
  await build({
    entryPoints: [path.join(root, 'packages/presentation/src/styles/request-card.css')],
    outfile: path.join(site, 'assets/request-card.css'),
    bundle: true,
    minify: true,
  });
  await fs.copyFile(path.join(site, 'assets/request-card.css'), path.join(studio, 'assets/request-card.css'));
  // Assets with fixed URLs get a content version, so a newly published page never pairs with a
  // cached script or stylesheet from the previous release. Missing files are simply unversioned.
  const versions: Record<string, string> = {};
  for (const file of ['article-search.js', 'card-fonts.css', 'request-card.css', 'math/katex.min.css']) {
    try {
      // Hash the text with normalised line endings: a Windows checkout writes CRLF, and the version
      // must not change (and dirty the committed manifest) when only the checkout differs.
      const text = (await fs.readFile(path.join(site, 'assets', file), 'utf8')).replace(/\r\n/g, '\n');
      versions['/assets/' + file] = createHash('sha256').update(text).digest('hex').slice(0, 10);
    } catch {}
  }
  await fs.writeFile(
    path.join(root, 'packages/presentation/src/asset-versions.json'),
    JSON.stringify(versions, null, 2) + '\n',
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildPresentation();
