import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { ContentSchema } from '@lzzhu/content';
import { seedSql } from '../packages/content/src/seed';
const snapshotFlag = process.argv.indexOf('--snapshot');
const snapshot = snapshotFlag < 0 ? 'content/site.json' : process.argv[snapshotFlag + 1];
if (!snapshot || snapshot.startsWith('--')) throw new Error('--snapshot requires a JSON file path');
const content = ContentSchema.parse(JSON.parse(await fs.readFile(snapshot, 'utf8')));
const sql = seedSql(content);
const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0) {
  if (!process.argv[outputFlag + 1] || process.argv[outputFlag + 1].startsWith('--'))
    throw new Error('--output requires a SQL file path');
  await fs.writeFile(process.argv[outputFlag + 1], sql);
} else {
  await fs.mkdir('.artifacts', { recursive: true });
  await fs.writeFile('.artifacts/seed.sql', sql);
  execFileSync(
    process.execPath,
    [
      'scripts/tool.mjs',
      'wrangler',
      'd1',
      'execute',
      'website-content',
      '--local',
      '--config',
      'apps/studio/wrangler.jsonc',
      '--file',
      '.artifacts/seed.sql',
    ],
    { stdio: 'inherit' },
  );
}
