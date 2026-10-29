import { Hono } from 'hono';
import { z } from 'zod';
import { localDevelopment } from './auth';
import { sha256, type AppEnv } from './types';
import { audit } from './repository';
import { requireRecipient } from './recipient-auth';
export const rewards = new Hono<AppEnv>();
async function state(db: D1Database) {
  return {
    ...(await db.prepare('SELECT remaining,revision FROM reward_state WHERE id=1').first()),
    requests: (
      await db
        .prepare('SELECT id,text,created_at FROM reward_requests ORDER BY created_at DESC LIMIT 200')
        .all()
    ).results,
  };
}
rewards.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
rewards.use('/api/rewards', requireRecipient);
rewards.get('/api/rewards', async (c) => c.json(await state(c.env.DB)));
rewards.post('/api/rewards', async (c) => {
  const origin = c.req.header('Origin') || '';
  const local = localDevelopment(c.env, new URL(c.req.url));
  if (
    !(local ? /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin) : origin === c.env.PUBLIC_ORIGIN)
  )
    return c.json({ error: 'Request verification failed' }, 403);
  if (Number(c.req.header('Content-Length')) > 4096) return c.json({ error: 'Request too large' }, 413);
  const raw = await c.req.text();
  if (raw.length > 4096) return c.json({ error: 'Request too large' }, 413);
  const body = z
    .object({ id: z.string().uuid(), request: z.string().trim().min(1).max(500) })
    .parse(JSON.parse(raw));
  const existing = await c.env.DB.prepare('SELECT id FROM reward_requests WHERE id=?').bind(body.id).first();
  if (existing) return c.json(await state(c.env.DB));
  const bucket = Math.floor(Date.now() / 600000);
  const key = await sha256(
    (c.env.CSRF_SECRET || 'local') + ':' + (c.req.header('CF-Connecting-IP') || 'local'),
  );
  const limit = await c.env.DB.prepare(
    'INSERT INTO request_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END RETURNING count',
  )
    .bind(key, bucket)
    .first<{ count: number }>();
  if ((limit?.count || 0) > 10) return c.json({ error: '请求过于频繁，请稍后再试' }, 429);
  try {
    await c.env.DB.prepare('INSERT OR IGNORE INTO reward_requests(id,text,created_at) VALUES(?,?,?)')
      .bind(body.id, body.request, new Date().toISOString())
      .run();
  } catch (error) {
    if (String(error).includes('No requests remaining')) return c.json({ error: '剩余次数不足' }, 409);
    throw error;
  }
  return c.json(await state(c.env.DB), 201);
});
rewards.get('/admin/api/rewards', async (c) => c.json(await state(c.env.DB)));
rewards.put('/admin/api/rewards', async (c) => {
  const body = z
    .object({
      remaining: z.number().int().min(0).max(100000),
      expectedRevision: z.number().int().nonnegative(),
    })
    .parse(await c.req.json());
  const result = await c.env.DB.prepare(
    'UPDATE reward_state SET remaining=?,revision=revision+1 WHERE id=1 AND revision=?',
  )
    .bind(body.remaining, body.expectedRevision)
    .run();
  if (!result.meta.changes) return c.json({ error: '次数已经变化，请刷新后重试' }, 409);
  await audit(c.env, c.get('identity').id, 'rewards.balance', String(body.remaining));
  return c.json(await state(c.env.DB));
});
rewards.delete('/admin/api/rewards/requests', async (c) => {
  await c.env.DB.prepare('DELETE FROM reward_requests').run();
  await audit(c.env, c.get('identity').id, 'rewards.clear', 'all');
  return c.json(await state(c.env.DB));
});
