import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContentSchema } from '@lzzhu/content';
import { seedSql } from '../../packages/content/src/seed';
import { testDatabase } from '../helpers/database';
import { failRelease } from '../../apps/studio/server/releases';
import { getContent, saveContent } from '../../apps/studio/server/repository';
import type { Env } from '../../apps/studio/server/types';

const databases: ReturnType<typeof testDatabase>[] = [];
function database() {
  const db = testDatabase();
  databases.push(db);
  return { ...db, env: { DB: db.DB } as Env };
}
afterEach(() => databases.splice(0).forEach(({ sqlite }) => sqlite.close()));

describe('publication lock ownership', () => {
  it.each(['deploying', 'deployed', 'active', 'superseded', 'cancelled'])(
    'a late failure cannot rewrite %s or release its lock',
    async (status) => {
      const { env, sqlite } = database();
      sqlite
        .prepare(
          'INSERT INTO releases(id,content_revision,source_commit,status,created_at,created_by) VALUES(?,0,?,?,?,?)',
        )
        .run('candidate', 'source', status, new Date().toISOString(), 'test');
      sqlite.exec("UPDATE site_state SET publishing_id='candidate'");
      await failRelease(env, 'candidate', 'Late dispatch or build failure');
      expect(sqlite.prepare('SELECT status FROM releases').get()?.status).toBe(status);
      expect(sqlite.prepare('SELECT publishing_id FROM site_state').get()?.publishing_id).toBe('candidate');
    },
  );
  it.each(['preparing', 'ready', 'building'])('safely releases a failed %s build', async (status) => {
    const { env, sqlite } = database();
    sqlite
      .prepare(
        'INSERT INTO releases(id,content_revision,source_commit,status,created_at,created_by) VALUES(?,0,?,?,?,?)',
      )
      .run('candidate', 'source', status, new Date().toISOString(), 'test');
    sqlite.exec("UPDATE site_state SET publishing_id='candidate'");
    await failRelease(env, 'candidate', 'Build failed before deployment');
    expect(sqlite.prepare('SELECT status FROM releases').get()?.status).toBe('failed');
    expect(sqlite.prepare('SELECT publishing_id FROM site_state').get()?.publishing_id).toBeNull();
  });
});

describe('content save transaction', () => {
  function seeded() {
    const db = database();
    const content = ContentSchema.parse(JSON.parse(readFileSync('content/site.json', 'utf8')));
    content.revision = 0;
    db.sqlite.exec(seedSql(content));
    return { ...db, content };
  }
  it('does not commit a save when its audit record cannot be stored', async () => {
    const { env, sqlite, content } = seeded();
    sqlite.exec(
      "CREATE TRIGGER simulate_log_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
    );
    await expect(
      saveContent(env, { ...content, settings: { ...content.settings, title: 'New title' } }, 0, 'editor'),
    ).rejects.toThrow('audit unavailable');
    expect(await getContent(env)).toEqual(content);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM revisions').get()?.count).toBe(1);
  });
  it('stores one audit record and revision per successful save, with no extra entry for stale retries', async () => {
    const { env, sqlite, content } = seeded();
    const saved = await saveContent(env, content, 0, 'editor');
    await expect(saveContent(env, content, 0, 'editor')).rejects.toThrow('Content changed');
    expect(saved.revision).toBe(1);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM revisions').get()?.count).toBe(2);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM audit_log').get()?.count).toBe(1);
  });
});
