import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { ContentSchema } from '@lzzhu/content';
import { composeResources, type ResourceValue } from '@lzzhu/content/resources';

// Local rehearsal + verified backup before applying the checked-in migration. Never targets remote D1.
const root = process.cwd(),
  directory = path.resolve(root, 'apps/studio/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = (await fs.readdir(directory)).filter(
  (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
);
const candidates = files.filter((name) => {
  const db = new DatabaseSync(path.join(directory, name), { readOnly: true });
  try {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='content'").get();
  } finally {
    db.close();
  }
});
if (candidates.length !== 1)
  throw new Error('Expected exactly one legacy local content database; no changes made.');
const sourcePath = path.join(directory, candidates[0]);
const output = path.resolve(
  root,
  '.artifacts/resource-migration',
  new Date().toISOString().replaceAll(':', '-'),
);
assert(output.startsWith(path.join(root, '.artifacts') + path.sep));
await fs.mkdir(output, { recursive: true });
const source = new DatabaseSync(sourcePath, { readOnly: true });
const before = ContentSchema.parse(
  JSON.parse(source.prepare('SELECT document FROM content WHERE id=1').get()!.document as string),
);
const revisionCount = source.prepare('SELECT count(*) AS n FROM revisions').get()!.n;
await backup(source, path.join(output, 'before.sqlite'));
source.close();
await fs.writeFile(path.join(output, 'content-before.json'), JSON.stringify(before));
await fs.copyFile(path.join(output, 'before.sqlite'), path.join(output, 'rehearsal.sqlite'));
const rehearsal = new DatabaseSync(path.join(output, 'rehearsal.sqlite'));
function inspect(db: DatabaseSync) {
  const rows = db.prepare('SELECT key,document FROM content_resources').all() as {
    key: string;
    document: string | null;
  }[];
  const revision = db.prepare('SELECT revision FROM workspace WHERE id=1').get()!.revision as number;
  return ContentSchema.parse(
    composeResources(
      new Map(
        rows.map((row) => [
          row.key,
          row.document === null ? null : (JSON.parse(row.document) as ResourceValue),
        ]),
      ),
      revision,
    ),
  );
}
rehearsal.exec(await fs.readFile('apps/studio/migrations/0003_resource_storage.sql', 'utf8'));
assert.deepEqual(inspect(rehearsal), before);
assert.equal(rehearsal.prepare('SELECT count(*) AS n FROM revisions').get()!.n, revisionCount);
rehearsal.close();
execFileSync(
  process.execPath,
  [
    'scripts/tool.mjs',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'website-content',
    '--local',
    '--config',
    'apps/studio/wrangler.jsonc',
  ],
  { stdio: 'inherit', windowsHide: true },
);
const after = new DatabaseSync(sourcePath, { readOnly: true });
assert.deepEqual(inspect(after), before);
assert.equal(after.prepare('SELECT count(*) AS n FROM revisions').get()!.n, revisionCount);
after.close();
console.log(
  JSON.stringify({
    verified: true,
    revision: before.revision,
    pages: before.pages.length,
    revisions: Number(revisionCount),
    backup: output,
  }),
);
