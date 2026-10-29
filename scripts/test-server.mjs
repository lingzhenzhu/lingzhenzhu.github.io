import { serveSite } from './serve-site.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
const root = process.cwd();
const studio = path.join(root, 'apps/studio');
const persist = path.join(root, '.artifacts/e2e-state');
if (!persist.startsWith(root + path.sep + '.artifacts' + path.sep))
  throw new Error('Unsafe test database path');
await fs.rm(persist, { recursive: true, force: true });
await fs.mkdir(persist, { recursive: true });
const tool = path.join(root, 'scripts/tool.mjs');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', ASTRO_TELEMETRY_DISABLED: '1' };
const run = (args) =>
  execFileSync(process.execPath, [tool, 'wrangler', ...args, '--local', '--persist-to', persist], {
    cwd: studio,
    env,
    stdio: 'pipe',
  });
run(['d1', 'migrations', 'apply', 'website-content']);
const sql = path.join(persist, 'seed.sql');
execFileSync(process.execPath, [tool, 'tsx', 'scripts/seed-local.ts', '--output', sql], {
  cwd: root,
  env,
  stdio: 'pipe',
  windowsHide: true,
});
run(['d1', 'execute', 'website-content', '--file', sql]);
// A local Pages-origin fixture exercises publication activation without contacting
// or mutating the real website. Only test code can write its marker file.
const publication = http.createServer(async (_request, response) => {
  try {
    response.setHeader('Content-Type', 'application/json');
    response.end(await fs.readFile(path.join(persist, 'publication-marker.json')));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => publication.listen(0, '127.0.0.1', resolve));
const publicationOrigin = 'http://127.0.0.1:' + publication.address().port;
const worker = spawn(
  process.execPath,
  [
    tool,
    'wrangler',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--host',
    '127.0.0.1',
    '--port',
    '8788',
    '--inspector-port',
    '9234',
    '--persist-to',
    persist,
    '--var',
    'ENVIRONMENT:local',
    '--var',
    'LOCAL_DEV_AUTH:1',
    '--var',
    'PUBLIC_ORIGIN:' + publicationOrigin,
  ],
  { cwd: studio, env, stdio: 'ignore' },
);
process.on('exit', () => worker.kill());
process.on('SIGTERM', () => process.exit(0));
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:8788/admin/api/session');
    if (response.ok) break;
    if (attempt === 119) throw new Error('Worker unavailable');
  } catch {
    if (attempt === 119) throw new Error('Worker failed to start');
  }
  await new Promise((r) => setTimeout(r, 500));
}
serveSite(4173, 8788);
