import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const schema = z.object({
  remainingCount: z.number().int().min(0).max(100000),
  requests: z.array(z.string().max(500)).max(10000),
});
const destination = '.artifacts/private-migration';
await fs.mkdir(destination, { recursive: true });
const checkedAt = new Date().toISOString();
const response = await fetch('https://firebase-proxy.lzzhu718.workers.dev/get-state', {
  signal: AbortSignal.timeout(15000),
  redirect: 'error',
});
if (!response.ok) {
  await fs.writeFile(
    destination + '/legacy-status.json',
    JSON.stringify({ checkedAt, status: response.status, exported: false }, null, 2),
  );
  throw new Error(
    'Legacy service returned HTTP ' + response.status + '. No balance or history was imported.',
  );
}
const raw = await response.text();
if (raw.length > 8_000_000) throw new Error('Unexpected export size');
const state = schema.parse(JSON.parse(raw));
const checksum = createHash('sha256').update(raw).digest('hex');
await fs
  .writeFile(destination + '/legacy-' + checksum + '.json', raw, { flag: 'wx' })
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
  });
await fs.writeFile(
  destination + '/legacy-status.json',
  JSON.stringify(
    { checkedAt, status: response.status, exported: true, sha256: checksum, requests: state.requests.length },
    null,
    2,
  ),
);
console.log(
  'Validated private export saved. Review and migrate only after target backup and an empty-state check.',
);
