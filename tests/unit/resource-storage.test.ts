import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContentSchema } from '@lzzhu/content';
import {
  resources,
  diffResources,
  historyEntry,
  applyResources,
  mergeAcknowledgement,
  parseResource,
  type ChangeRequest,
} from '@lzzhu/content/resources';
import { seedSql } from '../../packages/content/src/seed';
import { testDatabase } from '../helpers/database';
import { getWorkspace, getRevision, saveChanges } from '../../apps/studio/server/repository';
import type { Env } from '../../apps/studio/server/types';
const source = ContentSchema.parse(JSON.parse(readFileSync('content/site.json', 'utf8')));
const opened: ReturnType<typeof testDatabase>[] = [];
function setup() {
  const db = testDatabase();
  opened.push(db);
  db.sqlite.exec(seedSql(source));
  return { ...db, env: { DB: db.DB } as Env };
}
afterEach(() => opened.splice(0).forEach((db) => db.sqlite.close()));
function request(key: string, value: unknown, expected = source.revision): ChangeRequest {
  return {
    mutationId: crypto.randomUUID(),
    baseRevision: source.revision,
    changes: [{ key, expectedRevision: expected, value }],
  };
}
it('writes only changed resources; stale editors of different pages do not conflict', async () => {
  const { env, sqlite } = setup(),
    [a, b] = source.pages;
  await saveChanges(env, request('page:' + a.id, { ...a, title: 'First edit' }), 'alice');
  const result = await saveChanges(env, request('page:' + b.id, { ...b, title: 'Second edit' }), 'bob');
  const saved = (await getWorkspace(env))!;
  expect(saved.pages.find((p) => p.id === a.id)?.title).toBe('First edit');
  expect(saved.pages.find((p) => p.id === b.id)?.title).toBe('Second edit');
  expect(result.changes.map((c) => c.key).sort()).toEqual(['page:' + a.id, 'page:' + b.id].sort());
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM resource_versions').get()?.n).toBe(
    resources(source).size + 2,
  );
  expect(await getRevision(env, source.revision)).toEqual(source);
});
it('imports long Unicode documents below the D1 statement limit and safely resumes an interrupted import', async () => {
  const db = testDatabase();
  opened.push(db);
  const content = ContentSchema.parse({
    ...source,
    pages: source.pages.map((page, index) =>
      index
        ? page
        : {
            ...page,
            blocks: [
              {
                type: 'richText',
                id: 'long-import',
                document: {
                  type: 'doc',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: "中文🙂'\\".repeat(20000) }] },
                  ],
                },
              },
            ],
          },
    ),
  });
  const sql = seedSql(content),
    lines = sql.split('\n');
  expect(Math.max(...lines.map((line) => Buffer.byteLength(line)))).toBeLessThan(100000);
  db.sqlite.exec(lines.slice(0, 8).join('\n'));
  db.sqlite.exec(sql);
  db.sqlite.exec(sql);
  const env = { DB: db.DB } as Env;
  expect((await getWorkspace(env))!.pages).toEqual(content.pages);
  const existing = { ...source.pages[0], id: 'unwanted', path: '/unwanted/', template: 'page' };
  db.sqlite.exec(seedSql(ContentSchema.parse({ ...source, pages: [...source.pages, existing] })));
  expect((await getWorkspace(env))!.pages).toEqual(content.pages);
});
it('rejects same-page conflicts, identity changes, duplicate keys and oversized resources', async () => {
  const { env } = setup(),
    page = source.pages[0];
  await saveChanges(env, request('page:' + page.id, { ...page, title: 'Winner' }), 'alice');
  await expect(
    saveChanges(env, request('page:' + page.id, { ...page, title: 'Stale' }), 'bob'),
  ).rejects.toThrow('changed in another session');
  expect(() => parseResource('page:other', page)).toThrow('identity');
  expect(() => parseResource('news', 'x'.repeat(1800001))).toThrow('1.8 MB');
  const duplicate = request('settings', source.settings);
  duplicate.changes.push(duplicate.changes[0]);
  await expect(saveChanges(env, duplicate, 'alice')).rejects.toThrow('Duplicate');
});
it('retries a lost acknowledgement exactly once, including simultaneous duplicate requests', async () => {
  const { env, sqlite } = setup(),
    page = source.pages[0],
    change = request('page:' + page.id, { ...page, title: 'Saved once' });
  const [a, b] = await Promise.all([saveChanges(env, change, 'alice'), saveChanges(env, change, 'alice')]);
  expect(a.commitRevision).toBe(b.commitRevision);
  expect((await saveChanges(env, change, 'alice')).commitRevision).toBe(a.commitRevision);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM audit_log').get()?.n).toBe(1);
  await expect(
    saveChanges(env, { ...change, changes: [{ ...change.changes[0], value: page }] }, 'alice'),
  ).rejects.toThrow('different change');
});
it('validates cross-page constraints and rolls back all resource/history writes on failure', async () => {
  const { env, sqlite } = setup(),
    [a, b] = source.pages;
  await expect(saveChanges(env, request('page:' + b.id, { ...b, path: a.path }), 'alice')).rejects.toThrow(
    'unique',
  );
  sqlite.exec(
    "CREATE TRIGGER fail_history BEFORE INSERT ON resource_versions BEGIN SELECT RAISE(ABORT,'history unavailable'); END",
  );
  await expect(
    saveChanges(env, request('settings', { ...source.settings, title: 'New' }), 'alice'),
  ).rejects.toThrow('history unavailable');
  expect((await getWorkspace(env))?.revision).toBe(source.revision);
  expect((await getWorkspace(env))?.settings.title).toBe(source.settings.title);
});
it('preserves historical snapshots and deleted-ID versions during migration', async () => {
  const db = testDatabase(true);
  opened.push(db);
  const first = { ...source, revision: 0 },
    second = { ...source, revision: 1, pages: source.pages.slice(0, -1) };
  db.sqlite.prepare('INSERT INTO content VALUES(1,1,?,?,?)').run(JSON.stringify(second), 'now', 'editor');
  for (const value of [first, second])
    db.sqlite
      .prepare('INSERT INTO revisions VALUES(?,?,?,?)')
      .run(value.revision, JSON.stringify(value), 'now', 'editor');
  db.sqlite.exec(readFileSync('apps/studio/migrations/0003_resource_storage.sql', 'utf8'));
  const env = { DB: db.DB } as Env;
  expect(await getRevision(env, 0)).toEqual(first);
  expect(await getRevision(env, 1)).toEqual(second);
  expect((await getWorkspace(env))?.pages).toEqual(second.pages);
  expect((await getWorkspace(env))?.resourceVersions['page:' + source.pages.at(-1)!.id]).toBe(1);
});
it('undo keeps references to changed resources only and leaves unrelated pages intact', () => {
  const edited = { ...source, pages: source.pages.map((p, i) => (i ? p : { ...p, title: 'Changed' })) };
  const entry = historyEntry(source, edited);
  expect(entry.before).toHaveLength(1);
  expect(entry.before[0].value).toBe(source.pages[0]);
  expect(entry.after[0].value).toBe(edited.pages[0]);
  const restored = applyResources(edited, entry.before);
  expect(restored).toEqual(source);
  expect(restored.pages[1]).toBe(source.pages[1]);
});
it('deletes and restores a page atomically without losing historical versions or its concurrency guard', async () => {
  const { env } = setup();
  const page = source.pages.find((item) => item.template === 'article')!;
  const key = 'page:' + page.id,
    order = source.pages.map((item) => item.id);
  const deletion = request(key, null);
  deletion.changes.push({
    key: 'pageOrder',
    expectedRevision: source.revision,
    value: order.filter((id) => id !== page.id),
  });
  const removed = await saveChanges(env, deletion, 'alice');
  expect((await getWorkspace(env))!.pages.some((item) => item.id === page.id)).toBe(false);
  expect((await getRevision(env, source.revision))!.pages).toEqual(source.pages);
  await expect(
    saveChanges(
      env,
      { ...request(key, page), changes: [{ key, value: page, expectedRevision: null }] },
      'bob',
    ),
  ).rejects.toThrow('changed in another session');
  await saveChanges(
    env,
    {
      mutationId: crypto.randomUUID(),
      baseRevision: removed.revision,
      changes: [
        { key, value: page, expectedRevision: removed.revision },
        { key: 'pageOrder', value: order, expectedRevision: removed.revision },
      ],
    },
    'alice',
  );
  expect((await getWorkspace(env))!.pages.map((item) => item.id)).toEqual(order);
  expect((await getRevision(env, removed.revision))!.pages.some((item) => item.id === page.id)).toBe(false);
});
it('retains in-flight typing and merges independent remote changes without advancing conflicted versions', () => {
  const captured = { ...source, settings: { ...source.settings, title: 'Mine' } };
  const current = { ...captured, pages: source.pages.map((p, i) => (i ? p : { ...p, title: 'Typing' })) };
  const remote = [
    { key: 'settings', value: captured.settings, revision: 2 },
    {
      key: 'page:' + source.pages[0].id,
      value: { ...source.pages[0], title: 'Elsewhere', revision: 1 },
      revision: 1,
    },
  ];
  const merged = mergeAcknowledgement(
    source,
    captured,
    current,
    { settings: 0, ['page:' + source.pages[0].id]: 0 },
    { revision: 2, commitRevision: 2, changes: remote },
  );
  expect(merged.current.pages[0].title).toBe('Typing');
  expect(merged.saved.pages[0].title).toBe('Elsewhere');
  expect(merged.versions['page:' + source.pages[0].id]).toBe(0);
  expect(merged.conflicts).toHaveLength(1);
  expect(diffResources(merged.saved, merged.current)).toHaveLength(1);
});
it('retains a coherent draft when local and remote page membership change during a save', () => {
  const captured = { ...source, settings: { ...source.settings, title: 'Saved title' } };
  const addition = { ...source.pages[0], id: 'local-new', path: '/local-new/', template: 'page' as const };
  const current = { ...captured, pages: [...captured.pages, addition] };
  const removed = source.pages.find((page) => page.template === 'article')!;
  const remote = [
    { key: 'settings', value: captured.settings, revision: 2 },
    {
      key: 'pageOrder',
      value: source.pages.filter((page) => page.id !== removed.id).map((page) => page.id),
      revision: 1,
    },
    { key: 'page:' + removed.id, value: null, revision: 1 },
  ];
  const merged = mergeAcknowledgement(
    source,
    captured,
    current,
    { settings: 0, pageOrder: 0 },
    { revision: 2, commitRevision: 2, changes: remote },
  );
  expect(merged.current.pages).toEqual(current.pages);
  expect(merged.saved.pages.some((page) => page.id === removed.id)).toBe(false);
  expect(merged.conflicts).toEqual(['pageOrder']);
  expect(merged.versions.pageOrder).toBe(0);
});
