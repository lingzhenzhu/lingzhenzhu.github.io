import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = readFileSync('apps/studio/migrations/0005_archive_template.sql', 'utf8');
const page = (id: string, extra: Record<string, unknown>) => ({
  id,
  path: '/' + id + '/',
  template: 'page',
  inNavigation: false,
  blocks: [],
  ...extra,
});
const dated = (type: string, year?: string, month?: string) => ({ id: 'b-' + type + year, type, year, month });

it('0005 marks only standalone dated-list pages as archives, in current data and history', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE content_resources (key TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT);
    CREATE TABLE resource_versions (key TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT, PRIMARY KEY(key,revision));`);
  const pages = {
    year: page('year', { blocks: [dated('archive', '2023')] }),
    month: page('month', { blocks: [dated('articleSearch', '2023', '10'), dated('archive', '2023')] }),
    home: page('home', { template: 'home', blocks: [dated('archive', '2022')] }),
    mixed: page('mixed', { blocks: [dated('archive', '2023'), { id: 'text', type: 'richText' }] }),
    unfiltered: page('unfiltered', { blocks: [dated('articleSearch')] }),
    linked: page('linked', { inNavigation: true, blocks: [dated('archive', '2023')] }),
    empty: page('empty', {}),
    legacyDefault: page('legacy', { inNavigation: undefined, blocks: [dated('archive', undefined, '05')] }),
  };
  const insert = db.prepare('INSERT INTO content_resources VALUES (?, 1, ?)');
  const history = db.prepare('INSERT INTO resource_versions VALUES (?, 1, ?)');
  for (const value of Object.values(pages)) {
    insert.run('page:' + value.id, JSON.stringify(value));
    history.run('page:' + value.id, JSON.stringify(value));
  }
  insert.run('page:deleted', null);
  insert.run('settings', JSON.stringify({ template: 'page' }));
  db.exec(migration);
  db.exec(migration); // Replaying is harmless.
  const templates = (table: string) =>
    Object.fromEntries(
      (
        db
          .prepare(`SELECT key, json_extract(document, '$.template') AS template FROM ${table} WHERE key LIKE 'page:%'`)
          .all() as { key: string; template: string | null }[]
      ).map((row) => [row.key.slice(5), row.template]),
    );
  const expected = {
    year: 'archive',
    month: 'archive',
    home: 'home',
    mixed: 'page',
    unfiltered: 'page',
    linked: 'page',
    empty: 'page',
    legacy: 'archive',
  };
  expect(templates('content_resources')).toEqual({ ...expected, deleted: null });
  expect(templates('resource_versions')).toEqual(expected);
  expect(db.prepare("SELECT document FROM content_resources WHERE key='settings'").get()).toEqual({
    document: JSON.stringify({ template: 'page' }),
  });
});
