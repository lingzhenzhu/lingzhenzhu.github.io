import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as tar from 'tar';
import { ContentSchema, publicSnapshot } from '@lzzhu/content';
import { referencedUploads } from './assets/uploads';

const root = process.cwd();
const origin = process.env.STUDIO_ORIGIN || 'https://www.lzzhu.net';
if (origin !== 'https://www.lzzhu.net')
  throw new Error('Production releases are restricted to www.lzzhu.net');
const id = process.env.RELEASE_ID || '';
const runId = process.env.GITHUB_RUN_ID || '';
if (!/^[a-f0-9-]{36}$/.test(id) || !/^\d+$/.test(runId)) throw new Error('Release identity is missing');
const directory = path.join(root, '.artifacts/release');
const output = path.join(root, 'apps/site/dist');
const checksum = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function request(endpoint: string, init: RequestInit = {}) {
  const response = await fetch(origin + '/admin/api/releases/' + id + endpoint, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: {
      'CF-Access-Client-Id': process.env.ACCESS_CLIENT_ID || '',
      'CF-Access-Client-Secret': process.env.ACCESS_CLIENT_SECRET || '',
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      'Release API ' + endpoint + ': ' + response.status + ' ' + (await response.text()).slice(0, 500),
    );
  return response;
}
const post = (endpoint: string, data: unknown) =>
  request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
await fs.mkdir(directory, { recursive: true });
const stage = process.argv[2];
if (stage === 'prepare') {
  const { manifest, snapshot } = (await (await request('/snapshot')).json()) as {
    manifest: { id: string; snapshotHash: string; sourceCommit: string; rollbackOf: string | null };
    snapshot: string;
  };
  if (manifest.id !== id || checksum(snapshot) !== manifest.snapshotHash)
    throw new Error('Snapshot integrity check failed');
  const content = ContentSchema.parse(JSON.parse(snapshot));
  if (JSON.stringify(content) !== JSON.stringify(publicSnapshot(content)))
    throw new Error('Snapshot contains private editorial data');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== manifest.sourceCommit) throw new Error('Build source does not match the frozen release');
  await post('/claim', { runId });
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  const snapshotPath = path.join(directory, 'snapshot.json');
  const assetDir = path.join(directory, 'uploads');
  await fs.writeFile(snapshotPath, snapshot);
  if (process.env.GITHUB_ENV)
    await fs.appendFile(
      process.env.GITHUB_ENV,
      'SITE_SNAPSHOT=' +
        snapshotPath +
        '\nSITE_UPLOADS=' +
        assetDir +
        '\nROLLBACK=' +
        String(!!manifest.rollbackOf) +
        '\n',
    );
  if (manifest.rollbackOf) {
    const response = await request('/artifact');
    const archive = new Uint8Array(await response.arrayBuffer());
    if (checksum(archive) !== response.headers.get('X-Artifact-SHA256'))
      throw new Error('Rollback archive checksum mismatch');
    const archivePath = path.join(directory, 'rollback.tar.gz');
    await fs.writeFile(archivePath, archive);
    await fs.mkdir(output, { recursive: true });
    let invalid = false;
    let expanded = 0;
    await tar.t({
      file: archivePath,
      onReadEntry(entry) {
        expanded += entry.size;
        if (
          !['File', 'Directory'].includes(entry.type) ||
          path.isAbsolute(entry.path) ||
          entry.path.includes('\\') ||
          entry.path.split('/').includes('..') ||
          expanded > 256 * 1024 * 1024
        )
          invalid = true;
      },
    });
    if (invalid) throw new Error('Unsafe rollback archive');
    await tar.x({ file: archivePath, cwd: output, strict: true, preservePaths: false });
  } else {
    const assetIds = referencedUploads(snapshot);
    await fs.mkdir(assetDir, { recursive: true });
    for (const url of assetIds) {
      const filename = path.basename(url);
      const response = await request('/assets/' + filename);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (checksum(bytes) !== filename.split('.')[0])
        throw new Error('Uploaded asset integrity check failed');
      await fs.writeFile(path.join(assetDir, filename), bytes);
    }
  }
  console.log('Verified and claimed release ' + id);
} else if (stage === 'package') {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  await fs.writeFile(
    path.join(output, '_release.json'),
    JSON.stringify({ id, snapshotHash: manifest.snapshotHash, sourceCommit: manifest.sourceCommit }),
  );
  const archivePath = path.join(directory, 'site.tar.gz');
  await tar.c({ gzip: true, file: archivePath, cwd: output, portable: true }, ['.']);
  const bytes = await fs.readFile(archivePath);
  await request('/artifact', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/gzip', 'X-Artifact-SHA256': checksum(bytes), 'X-Run-Id': runId },
    body: bytes,
  });
  console.log('Saved verified rollback artifact');
} else if (stage === 'deploy') {
  await post('/deploy', { runId });
} else if (stage === 'report') {
  const stage = process.env.DEPLOYMENT_RESULT === 'success' ? 'deployed' : 'failed';
  await post('/report', {
    runId,
    stage,
    error: stage === 'failed' ? 'GitHub workflow did not complete successfully' : undefined,
  });
  console.log(
    stage === 'deployed'
      ? 'Deployment reported; the Worker verifies the live release marker.'
      : 'Failure reported; publication remains recoverable.',
  );
} else throw new Error('Use prepare, package or report');
