import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env, Identity } from './types';
const verifiers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export function localDevelopment(env: Env, url: URL) {
  return (
    env.ENVIRONMENT === 'local' &&
    String(env.LOCAL_DEV_AUTH) === '1' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  );
}
export async function verifyAccess(env: Env, request: Request, audience: string) {
  if (new URL(request.url).origin !== env.PUBLIC_ORIGIN || env.PUBLIC_ORIGIN !== 'https://www.lzzhu.net')
    return null;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER) || !audience) return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  try {
    let keys = verifiers.get(env.ACCESS_ISSUER);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(env.ACCESS_ISSUER + '/cdn-cgi/access/certs'));
      verifiers.set(env.ACCESS_ISSUER, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: env.ACCESS_ISSUER,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat'],
    });
    return payload;
  } catch {
    return null;
  }
}
export async function identify(env: Env, request: Request): Promise<Identity | null> {
  if (localDevelopment(env, new URL(request.url))) return { id: 'local-editor', role: 'editor', local: true };
  try {
    const payload = await verifyAccess(env, request, env.ACCESS_AUD);
    if (!payload) return null;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (
      email &&
      env.ADMIN_EMAILS.split(',')
        .map((value) => value.trim().toLowerCase())
        .includes(email)
    )
      return { id: email, role: 'editor', local: false };
    if (env.BUILD_SERVICE_ID && payload.common_name === env.BUILD_SERVICE_ID)
      return { id: env.BUILD_SERVICE_ID, role: 'build', local: false };
    return null;
  } catch {
    return null;
  }
}
export async function csrfToken(env: Env, identity: Identity) {
  const secret = identity.local ? 'local-development-only-do-not-deploy' : env.CSRF_SECRET;
  if (!secret || secret.length < 32) throw new Error('CSRF_SECRET must be configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('studio:' + identity.id));
  return Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('');
}
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = await identify(c.env, c.req.raw);
  if (!identity) return c.json({ error: 'Authentication required' }, 401);
  c.set('identity', identity);
  const path = new URL(c.req.url).pathname;
  if (
    identity.role === 'build' &&
    !/^\/admin\/api\/releases\/[a-f0-9-]+\/(?:snapshot|claim|deploy|report|artifact|assets\/[a-f0-9]{64}\.(?:jpg|png|webp))$/.test(
      path,
    )
  )
    return c.json({ error: 'Build identity cannot access editorial data' }, 403);
  if (identity.role === 'editor' && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const requestOrigin = c.req.header('Origin') || '';
    const validOrigin = identity.local
      ? /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(requestOrigin)
      : requestOrigin === envOrigin(c.env);
    if (!validOrigin || c.req.header('X-CSRF-Token') !== (await csrfToken(c.env, identity)))
      return c.json({ error: 'Request verification failed' }, 403);
  }
  await next();
};
function envOrigin(env: Env) {
  return env.PUBLIC_ORIGIN;
}
