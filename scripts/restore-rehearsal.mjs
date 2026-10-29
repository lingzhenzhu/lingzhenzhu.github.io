import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';

// Restores the isolated regression database only. Never reads or writes the everyday preview database.
const root = process.cwd();
const source = path.resolve(root, '.artifacts/e2e-state');
const target = path.resolve(root, '.artifacts/restore-' + Date.now());
const output = path.join(target, 'database.sql');
if (![source, target].every((p) => p.startsWith(root + path.sep + '.artifacts' + path.sep)))
  throw Error('Unsafe rehearsal path');
await fs.access(source);
await fs.mkdir(target, { recursive: true });
const run = (state, args) =>
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/tool.mjs'), 'wrangler', 'd1', ...args, '--local', '--persist-to', state],
    {
      cwd: path.join(root, 'apps/studio'),
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
// Wrangler export has no --persist-to option. Take consistent SQLite snapshots into
// an isolated CLI project; its default persistence directory is safe to export.
const exportRoot = path.join(target, 'export-project');
const exportState = path.join(exportRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
await fs.mkdir(exportState, { recursive: true });
const d1Root = path.join(source, 'v3/d1/miniflare-D1DatabaseObject');
for (const filename of (await fs.readdir(d1Root)).filter((file) => file.endsWith('.sqlite'))) {
  const database = new DatabaseSync(path.join(d1Root, filename), { readOnly: true });
  try {
    await backup(database, path.join(exportState, filename));
  } finally {
    database.close();
  }
}
const config = JSON.parse(await fs.readFile('apps/studio/wrangler.jsonc', 'utf8'));
const exportConfig = path.join(exportRoot, 'wrangler.json');
await fs.writeFile(
  exportConfig,
  JSON.stringify({
    name: 'restore-rehearsal',
    compatibility_date: config.compatibility_date,
    d1_databases: config.d1_databases,
  }),
);
execFileSync(
  process.execPath,
  [
    path.join(root, 'scripts/tool.mjs'),
    'wrangler',
    'd1',
    'export',
    'website-content',
    '--local',
    '--config',
    exportConfig,
    '--output',
    output,
  ],
  { encoding: 'utf8', windowsHide: true },
);
run(target, ['execute', 'website-content', '--file', output]);
const query =
  "SELECT 'content_resources' AS name,count(*) AS rows,coalesce(sum(length(document)),0) AS size FROM content_resources UNION ALL SELECT 'resource_versions',count(*),coalesce(sum(length(document)),0) FROM resource_versions UNION ALL SELECT 'assets',count(*),coalesce(sum(size),0) FROM assets UNION ALL SELECT 'requests',count(*),coalesce(sum(length(text)),0) FROM reward_requests UNION ALL SELECT 'balance',remaining,revision FROM reward_state";
const inspect = (state) =>
  JSON.parse(run(state, ['execute', 'website-content', '--command', query, '--json']))[0].results;
const snapshotState = path.join(exportRoot, '.wrangler/state');
const before = inspect(snapshotState),
  after = inspect(target);
if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Restored database does not match');
const tables = [
  'workspace',
  'content_resources',
  'resource_versions',
  'revisions',
  'assets',
  'reward_state',
  'reward_requests',
  'releases',
  'site_state',
  'feed_state',
  'audit_log',
  'request_limits',
];
const contentsHash = (state, table) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        JSON.parse(
          run(state, [
            'execute',
            'website-content',
            '--command',
            `SELECT * FROM ${table} ORDER BY rowid`,
            '--json',
          ]),
        )[0].results,
      ),
    )
    .digest('hex');
const tableHashes = tables.map((table) => ({
  table,
  before: contentsHash(snapshotState, table),
  after: contentsHash(target, table),
}));
if (tableHashes.some((table) => table.before !== table.after)) throw Error('Restored table contents differ');
const dump = await fs.readFile(output);
const report = {
  checkedAt: new Date().toISOString(),
  scope: 'isolated local D1; private R2 production restore remains a deployment acceptance check',
  sha256: createHash('sha256').update(dump).digest('hex'),
  before,
  after,
  tableHashes,
};
await fs.writeFile(path.join(target, 'verification.json'), JSON.stringify(report, null, 2));
console.log(
  'Restored isolated D1 export and verified table counts, document sizes and request balance:',
  path.relative(root, target),
);
