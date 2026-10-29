import type { MiddlewareHandler } from 'hono';
import { localDevelopment, verifyAccess } from './auth';
import type { AppEnv, Env } from './types';

export async function identifyRecipient(env: Env, request: Request): Promise<string | null> {
  if (localDevelopment(env, new URL(request.url))) return 'local-recipient';
  const payload = await verifyAccess(env, request, env.REWARDS_ACCESS_AUD);
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : '';
  const allowed = [env.REWARDS_EMAILS, env.ADMIN_EMAILS]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return email && allowed.includes(email) ? email : null;
}
export const requireRecipient: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!(await identifyRecipient(c.env, c.req.raw)))
    return c.json({ error: 'Recipient sign-in required' }, 401);
  await next();
};
