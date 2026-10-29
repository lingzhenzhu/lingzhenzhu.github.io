import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { localDevelopment } from '../auth';
import { sha256, type AppEnv } from '../types';
import { firebaseConfig, FirebaseCardError } from './config';
import { firebaseAdmin, signInFirebaseAdmin } from './auth';
import {
  changeFirebaseState,
  publicFirebaseState,
  readFirebaseState,
  submitFirebaseRequest,
} from './database';

export const firebaseCard = new Hono<AppEnv>();
firebaseCard.onError((error, c) => {
  if (error instanceof FirebaseCardError) return c.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ error: '输入内容无效，请检查后重试' }, 400);
  return c.json({ error: '申请卡暂不可用，请稍后重试' }, 503);
});
const prefix = '/api/firebase-card';
const sessionName = (local: boolean) => (local ? 'local-firebase-card' : '__Host-lzzhu-firebase-admin');
firebaseCard.use(prefix + '*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  try {
    firebaseConfig(c.env);
    const url = new URL(c.req.url);
    const local = localDevelopment(c.env, url);
    if (!local && (url.origin !== c.env.PUBLIC_ORIGIN || url.protocol !== 'https:'))
      return c.json({ error: '请求地址无效' }, 403);
    const origin = c.req.header('Origin') || '';
    const sameOrigin = local
      ? /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)
      : origin === url.origin;
    if (!['GET', 'HEAD'].includes(c.req.method) && !sameOrigin)
      return c.json({ error: '请求验证失败，请刷新页面' }, 403);
    if (!local && !c.env.CSRF_SECRET) throw new FirebaseCardError('申请卡尚未配置完成');
    const action =
      c.req.path.endsWith('/session') && c.req.method === 'POST'
        ? 'login'
        : c.req.method === 'GET'
          ? 'read'
          : 'write';
    const key =
      'firebase:' +
      (await sha256(
        (c.env.CSRF_SECRET || 'local') + ':' + action + ':' + (c.req.header('CF-Connecting-IP') || 'unknown'),
      ));
    const limit = await c.env.DB.prepare(
      'INSERT INTO request_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END RETURNING count',
    )
      .bind(key, Math.floor(Date.now() / 600000))
      .first<{ count: number }>();
    if (!limit) throw new FirebaseCardError('申请卡暂不可用');
    if (limit.count > { login: 6, read: 120, write: 20 }[action]) {
      c.header('Retry-After', '600');
      return c.json({ error: '操作过于频繁，请稍后再试' }, 429);
    }
    await next();
  } catch (error) {
    if (error instanceof FirebaseCardError) return c.json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json({ error: '输入内容无效，请检查后重试' }, 400);
    throw error;
  }
});
firebaseCard.get(prefix, async (c) => c.json(publicFirebaseState((await readFirebaseState(c.env)).state)));
firebaseCard.post(prefix, async (c) => {
  const body = z
    .object({ id: z.string().uuid(), request: z.string().trim().min(1).max(500) })
    .strict()
    .parse(await c.req.json());
  const state = await changeFirebaseState(c.env, (state) =>
    submitFirebaseRequest(state, body.id, body.request),
  );
  return c.json(publicFirebaseState(state));
});
firebaseCard.get(prefix + '/session', async (c) => {
  const local = localDevelopment(c.env, new URL(c.req.url));
  return c.json({ authenticated: await firebaseAdmin(c.env, getCookie(c, sessionName(local))) });
});
firebaseCard.post(prefix + '/session', async (c) => {
  const body = z
    .object({ password: z.string().min(1).max(1024) })
    .strict()
    .parse(await c.req.json());
  const token = await signInFirebaseAdmin(c.env, body.password);
  const local = localDevelopment(c.env, new URL(c.req.url));
  setCookie(c, sessionName(local), token, {
    httpOnly: true,
    secure: !local,
    sameSite: 'Strict',
    path: '/',
    maxAge: 3600,
  });
  return c.json({ authenticated: true });
});
firebaseCard.delete(prefix + '/session', (c) => {
  const local = localDevelopment(c.env, new URL(c.req.url));
  deleteCookie(c, sessionName(local), { secure: !local, httpOnly: true, sameSite: 'Strict', path: '/' });
  return c.json({ authenticated: false });
});
firebaseCard.use(prefix + '/admin/*', async (c, next) => {
  const local = localDevelopment(c.env, new URL(c.req.url));
  if (!(await firebaseAdmin(c.env, getCookie(c, sessionName(local)))))
    return c.json({ error: '请先登录管理员账号' }, 401);
  await next();
});
const revision = z.number().int().nonnegative();
firebaseCard.put(prefix + '/admin/balance', async (c) => {
  const body = z
    .object({ remaining: z.number().int().min(0).max(100000), expectedRevision: revision })
    .strict()
    .parse(await c.req.json());
  const state = await changeFirebaseState(c.env, (state) => {
    if (state.revision !== body.expectedRevision)
      throw new FirebaseCardError('次数或记录已经变化，请刷新后重试', 409);
    return { ...state, remainingCount: body.remaining, revision: state.revision + 1 };
  });
  return c.json(publicFirebaseState(state));
});
firebaseCard.delete(prefix + '/admin/requests', async (c) => {
  const body = z
    .object({ expectedRevision: revision })
    .strict()
    .parse(await c.req.json());
  const state = await changeFirebaseState(c.env, (state) => {
    if (state.revision !== body.expectedRevision)
      throw new FirebaseCardError('次数或记录已经变化，请刷新后重试', 409);
    return { ...state, requests: null, revision: state.revision + 1 };
  });
  return c.json(publicFirebaseState(state));
});
