import { Conflict } from './repository';
import type { Env, Release } from './types';

export const artifactKey = (id: string, hash: string) => `releases/${id}/artifacts/${hash}.tar.gz`;

/** Retries can store the same artifact, but cannot replace a verified build. */
export async function storeReleaseArtifact(env: Env, release: Release, bytes: ArrayBuffer, hash: string) {
  await env.PRIVATE.put(artifactKey(release.id, hash), bytes, { customMetadata: { sha256: hash } });
  const result = await env.DB.prepare(
    "UPDATE releases SET artifact_hash=? WHERE id=? AND status='building' AND run_id=? AND (artifact_hash IS NULL OR artifact_hash=?) AND EXISTS(SELECT 1 FROM site_state WHERE id=1 AND publishing_id=releases.id AND active_id IS releases.base_id)",
  )
    .bind(hash, release.id, release.run_id, hash)
    .run();
  if (!result.meta.changes) throw new Conflict('The build changed or its artifact was already frozen');
}
