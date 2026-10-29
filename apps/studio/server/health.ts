import { Hono } from 'hono';
import type { AppEnv } from './types';
import { RESOURCE_BYTES, WORKSPACE_BYTES } from '@lzzhu/content/resources';

export const health = new Hono<AppEnv>();
health.get('/', async (c) => {
  const [database, objects, state, content] = await Promise.all([
    c.env.DB.prepare('SELECT 1 AS available').first<{ available: number }>(),
    c.env.PRIVATE.list({ limit: 1 }),
    c.env.DB.prepare('SELECT active_id,publishing_id FROM site_state WHERE id=1').first(),
    c.env.DB.prepare(
      'SELECT revision,(SELECT SUM(length(CAST(document AS BLOB))) FROM content_resources) AS bytes FROM workspace WHERE id=1',
    ).first<{
      revision: number;
      bytes: number;
    }>(),
  ]);
  c.header('Cache-Control', 'private, no-store');
  return c.json({
    checkedAt: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    database: database?.available === 1,
    privateStorage: Array.isArray(objects.objects),
    imageDecoder: typeof c.env.IMAGES?.info === 'function',
    content: content
      ? {
          ...content,
          capacityBytes: WORKSPACE_BYTES,
          storage: 'per-resource',
          resourceCapacityBytes: RESOURCE_BYTES,
        }
      : null,
    publication: state,
    sourceCommit: c.env.SOURCE_COMMIT || null,
  });
});
