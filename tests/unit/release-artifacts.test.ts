import { afterEach, expect, it } from 'vitest';
import { testDatabase } from '../helpers/database';
import { artifactKey, storeReleaseArtifact } from '../../apps/studio/server/release-artifacts';
import { releaseById } from '../../apps/studio/server/releases';
import { sha256, type Env } from '../../apps/studio/server/types';

const databases: ReturnType<typeof testDatabase>[] = [];
afterEach(() => databases.splice(0).forEach(({ sqlite }) => sqlite.close()));
it('keeps a frozen rollback artifact intact when a late upload overlaps deployment', async () => {
  const db = testDatabase();
  databases.push(db);
  const objects = new Map<string, ArrayBuffer>();
  let afterPut = () => {};
  const env = {
    DB: db.DB,
    PRIVATE: {
      put: async (key: string, bytes: ArrayBuffer) => {
        objects.set(key, bytes);
        afterPut();
      },
    },
  } as unknown as Env;
  db.sqlite.exec(
    "INSERT INTO releases(id,content_revision,source_commit,status,run_id,created_at,created_by) VALUES('candidate',0,'source','building','1','2026-10-25','test'); UPDATE site_state SET publishing_id='candidate'",
  );
  const release = (await releaseById(env, 'candidate'))!;
  const original = new TextEncoder().encode('original artifact').buffer;
  const hash = await sha256(original);
  await storeReleaseArtifact(env, release, original, hash);
  await storeReleaseArtifact(env, release, original, hash);
  const replacement = new TextEncoder().encode('late replacement').buffer;
  const replacementHash = await sha256(replacement);
  await expect(storeReleaseArtifact(env, release, replacement, replacementHash)).rejects.toThrow(
    'already frozen',
  );
  afterPut = () => db.sqlite.exec("UPDATE releases SET status='deploying' WHERE id='candidate'");
  await expect(storeReleaseArtifact(env, release, replacement, replacementHash)).rejects.toThrow(
    'build changed',
  );
  expect((await releaseById(env, release.id))?.artifact_hash).toBe(hash);
  expect(objects.get(artifactKey(release.id, hash))).toEqual(original);
});
