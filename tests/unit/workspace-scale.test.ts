import { expect, it } from 'vitest';
import seed from '../../content/site.json';
import { ContentSchema } from '@lzzhu/content';
import { resources, diffResources, historyEntry, type HistoryEntry } from '@lzzhu/content/resources';
import { largeWorkspace } from '../helpers/large-workspace';
import { historyBytes, trimHistory } from '../../apps/studio/editor/resource-history';
import { testDatabase } from '../helpers/database';
import { seedSql } from '../../packages/content/src/seed';
import { getWorkspace, saveChanges } from '../../apps/studio/server/repository';
import type { Env } from '../../apps/studio/server/types';
it('supports a multi-megabyte workspace without whole-site undo copies or whole-site writes', async () => {
  const content = ContentSchema.parse(largeWorkspace(ContentSchema.parse(seed)));
  const wholeBytes = Buffer.byteLength(JSON.stringify(content));
  expect(wholeBytes).toBeGreaterThan(1800000);
  const history: HistoryEntry[] = [];
  let current = content;
  const started = performance.now();
  for (let i = 0; i < 1000; i++) {
    const next = {
      ...current,
      pages: current.pages.map((p, index) =>
        index === current.pages.length - 1 ? { ...p, title: 'Continuous edit ' + i } : p,
      ),
    };
    history.push(historyEntry(current, next));
    trimHistory(history);
    current = next;
  }
  const editingMs = performance.now() - started,
    retainedBytes = historyBytes(history);
  expect(history).toHaveLength(50);
  expect(retainedBytes).toBeLessThan(250000);
  const changes = diffResources(content, current);
  expect(changes).toHaveLength(1);
  expect(Buffer.byteLength(JSON.stringify(changes))).toBeLessThan(wholeBytes / 100);
  expect(current.pages[0]).toBe(content.pages[0]);
  const { DB, sqlite } = testDatabase();
  try {
    sqlite.exec(seedSql(content));
    const env = { DB } as Env;
    const samples: number[] = [];
    let version = content.revision;
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const response = await saveChanges(
        env,
        {
          mutationId: crypto.randomUUID(),
          baseRevision: version,
          changes: [
            {
              key: changes[0].key,
              value: { ...current.pages.at(-1)!, title: 'Saved edit ' + i },
              expectedRevision: version,
            },
          ],
        },
        'scale-test',
      );
      version = response.commitRevision;
      samples.push(performance.now() - start);
      expect(response.changes).toHaveLength(1);
    }
    expect((await getWorkspace(env))?.pages.at(-1)?.title).toBe('Saved edit 19');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM resource_versions').get()?.n).toBe(
      resources(content).size + 20,
    );
    console.info(
      'WORKSPACE_SCALE',
      JSON.stringify({
        pages: content.pages.length,
        wholeBytes,
        retainedBytes,
        editingMs: Math.round(editingMs),
        saveMedianMs: Math.round(samples.sort((a, b) => a - b)[10]),
        saveMaxMs: Math.round(Math.max(...samples)),
      }),
    );
  } finally {
    sqlite.close();
  }
}, 30000);
