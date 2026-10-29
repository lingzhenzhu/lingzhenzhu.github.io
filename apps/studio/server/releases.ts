import { importPKCS8, SignJWT } from 'jose';
import { ContentSchema, publicSnapshot, type Content } from '@lzzhu/content';
import { sha256, type Env, type Release } from './types';
import { audit, Conflict } from './repository';

export async function githubToken(env: Env): Promise<string> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_INSTALLATION_ID || !env.GITHUB_PRIVATE_KEY)
    throw new Error('GitHub App credentials are not configured');
  const key = await importPKCS8(env.GITHUB_PRIVATE_KEY.replaceAll('\\n', '\n'), 'RS256');
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(env.GITHUB_APP_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime('9m')
    .sign(key);
  const response = await fetch(
    'https://api.github.com/app/installations/' + env.GITHUB_INSTALLATION_ID + '/access_tokens',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + jwt,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lzzhu-studio',
      },
      body: JSON.stringify({
        repositories: [env.GITHUB_REPOSITORY.split('/')[1]],
        permissions: { contents: 'write', actions: 'write' },
      }),
    },
  );
  if (!response.ok) throw new Error('GitHub installation token failed: ' + response.status);
  return ((await response.json()) as { token: string }).token;
}
export async function releaseById(env: Env, id: string) {
  return env.DB.prepare('SELECT * FROM releases WHERE id=?').bind(id).first<Release>();
}
export async function readSnapshot(env: Env, id: string) {
  const object = await env.PRIVATE.get('releases/' + id + '/snapshot.json');
  if (!object) throw new Error('Release snapshot missing');
  return ContentSchema.parse(JSON.parse(await object.text()));
}
export async function startRelease(
  env: Env,
  input: Content,
  actor: string,
  options: { rollbackOf?: string; expectedBase?: string } = {},
) {
  if (!/^[a-f0-9]{40}$/.test(env.SOURCE_COMMIT) && env.ENVIRONMENT !== 'local')
    throw new Error('SOURCE_COMMIT must identify the reviewed source commit');
  const state = await env.DB.prepare('SELECT active_id,publishing_id FROM site_state WHERE id=1').first<{
    active_id: string | null;
    publishing_id: string | null;
  }>();
  if (state?.publishing_id) throw new Conflict('Another release is in progress');
  if (options.expectedBase && state?.active_id !== options.expectedBase)
    throw new Conflict('Published content changed; refresh the automatic update');
  const id = crypto.randomUUID();
  const snapshot = publicSnapshot(input);
  const json = JSON.stringify(snapshot);
  const hash = await sha256(json);
  const now = new Date().toISOString();
  const source = options.rollbackOf
    ? (await releaseById(env, options.rollbackOf))?.source_commit
    : env.SOURCE_COMMIT;
  const results = await env.DB.batch([
    env.DB.prepare(
      'UPDATE site_state SET publishing_id=? WHERE id=1 AND publishing_id IS NULL AND active_id IS ?',
    ).bind(id, state?.active_id || null),
    env.DB.prepare(
      'INSERT INTO releases(id,base_id,content_revision,source_commit,status,created_at,created_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM site_state WHERE id=1 AND publishing_id=?)',
    ).bind(id, state?.active_id || null, input.revision, source || 'local', 'preparing', now, actor, id),
  ]);
  if (!results[0].meta.changes) throw new Conflict('Another publication started');
  try {
    await env.PRIVATE.put('releases/' + id + '/snapshot.json', json, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { sha256: hash },
    });
    const metadata = {
      id,
      snapshotHash: hash,
      sourceCommit: source || 'local',
      rollbackOf: options.rollbackOf || null,
    };
    await env.PRIVATE.put('releases/' + id + '/manifest.json', JSON.stringify(metadata));
    const controls = options.rollbackOf
      ? await env.PRIVATE.get('releases/' + options.rollbackOf + '/medium-controls.json')
      : null;
    await env.PRIVATE.put(
      'releases/' + id + '/medium-controls.json',
      controls ? await controls.text() : JSON.stringify(input.medium),
    );
    await env.DB.prepare(
      "UPDATE releases SET status='ready',snapshot_hash=? WHERE id=? AND status='preparing'",
    )
      .bind(hash, id)
      .run();
    // Record the intent before external work can start. Logging must never invalidate
    // a deployment that GitHub has already accepted.
    await audit(env, actor, options.rollbackOf ? 'release.rollback' : 'release.create', id);
    if (env.ENVIRONMENT !== 'local') {
      const token = await githubToken(env);
      const response = await fetch('https://api.github.com/repos/' + env.GITHUB_REPOSITORY + '/dispatches', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'lzzhu-studio',
        },
        body: JSON.stringify({
          event_type: 'publish-site',
          client_payload: { releaseId: id, sourceCommit: source, rollbackOf: options.rollbackOf || null },
        }),
      });
      if (!response.ok) throw new Error('GitHub dispatch failed: ' + response.status);
    }
    return { ...metadata, local: env.ENVIRONMENT === 'local' };
  } catch (error) {
    await failRelease(env, id, String(error));
    throw error;
  }
}
export async function failRelease(env: Env, id: string, message: string) {
  // Check the state in the write, not just in a caller's earlier read. Once a
  // deployment may be in flight, reconciliation owns the lock and its outcome.
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE releases SET status='failed',error=? WHERE id=? AND status IN ('preparing','ready','building')",
    ).bind(message.slice(0, 1000), id),
    env.DB.prepare(
      "UPDATE site_state SET publishing_id=NULL WHERE id=1 AND publishing_id=? AND EXISTS(SELECT 1 FROM releases WHERE id=? AND status='failed')",
    ).bind(id, id),
  ]);
}
export async function claimRelease(env: Env, id: string, runId: string) {
  if (!/^\d{1,30}$/.test(runId)) throw new Error('Invalid build run');
  const result = await env.DB.prepare(
    "UPDATE releases SET status='building',run_id=? WHERE id=? AND (status='ready' OR (status='building' AND run_id=?)) AND EXISTS(SELECT 1 FROM site_state WHERE id=1 AND publishing_id=? AND active_id IS releases.base_id)",
  )
    .bind(runId, id, runId, id)
    .run();
  if (!result.meta.changes) throw new Conflict('This release is not eligible to deploy');
}
export async function activateRelease(env: Env, id: string) {
  const release = await releaseById(env, id);
  if (!release) throw new Error('Unknown release');
  if (release.status === 'active') return true;
  const response = await fetch(env.PUBLIC_ORIGIN + '/_release.json?verify=' + crypto.randomUUID(), {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const marker = (await response.json()) as { id?: string; snapshotHash?: string };
  if (marker.id !== id || marker.snapshotHash !== release.snapshot_hash) return false;
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE releases SET status='superseded' WHERE id=(SELECT active_id FROM site_state WHERE id=1 AND publishing_id=?) AND EXISTS(SELECT 1 FROM releases candidate JOIN site_state state ON state.id=1 WHERE candidate.id=? AND candidate.status IN ('building','deploying','deployed') AND state.active_id IS candidate.base_id)",
    ).bind(id, id),
    env.DB.prepare(
      "UPDATE releases SET status='active',error=NULL WHERE id=? AND status IN ('building','deploying','deployed') AND EXISTS(SELECT 1 FROM site_state WHERE id=1 AND publishing_id=? AND active_id IS releases.base_id)",
    ).bind(id, id),
    env.DB.prepare(
      "UPDATE site_state SET active_id=?,publishing_id=NULL WHERE id=1 AND publishing_id=? AND EXISTS(SELECT 1 FROM releases WHERE id=? AND status='active')",
    ).bind(id, id, id),
  ]);
  return !!results[2].meta.changes;
}
export async function reconcileRelease(env: Env) {
  const state = await env.DB.prepare('SELECT publishing_id FROM site_state WHERE id=1').first<{
    publishing_id: string | null;
  }>();
  if (!state?.publishing_id) return;
  const release = await releaseById(env, state.publishing_id);
  if (!release) return;
  if (['building', 'deploying', 'deployed'].includes(release.status)) {
    if (await activateRelease(env, release.id)) return;
    if (release.run_id && env.ENVIRONMENT !== 'local') {
      const token = await githubToken(env);
      const response = await fetch(
        'https://api.github.com/repos/' + env.GITHUB_REPOSITORY + '/actions/runs/' + release.run_id,
        {
          headers: {
            Authorization: 'Bearer ' + token,
            'User-Agent': 'lzzhu-studio',
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (response.ok) {
        const run = (await response.json()) as { status: string; conclusion: string | null };
        if (run.status === 'completed' && run.conclusion !== 'success' && release.status === 'building')
          await failRelease(env, release.id, 'GitHub build concluded: ' + run.conclusion);
      }
    }
  } else if (release.status === 'preparing' && Date.now() - Date.parse(release.created_at) > 15 * 60_000) {
    await failRelease(env, release.id, 'Snapshot preparation interrupted; retry publishing');
  }
}
