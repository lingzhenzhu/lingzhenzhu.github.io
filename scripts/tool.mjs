import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const [tool, ...args] = process.argv.slice(2);
const packagePath = require.resolve(tool + '/package.json');
const definition = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const bin = typeof definition.bin === 'string' ? definition.bin : definition.bin[tool];
fs.mkdirSync(path.join(root, '.artifacts'), { recursive: true });
const child = spawn(process.execPath, [path.resolve(path.dirname(packagePath), bin), ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    WRANGLER_SEND_METRICS: 'false',
    WRANGLER_LOG_PATH: path.join(root, '.artifacts/wrangler.log'),
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const event of ['SIGINT', 'SIGTERM']) process.on(event, () => child.kill(event));
