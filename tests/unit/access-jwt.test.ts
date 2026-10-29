import { beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from 'jose';
import { Hono } from 'hono';
import { authenticate, csrfToken, identify } from '../../apps/studio/server/auth';
import type { AppEnv, Env } from '../../apps/studio/server/types';
import { identifyRecipient } from '../../apps/studio/server/recipient-auth';
import { rewards } from '../../apps/studio/server/rewards';

const keyset = vi.hoisted(() => ({ keys: [] }) as JSONWebKeySet);
vi.mock('jose', async (original) => {
  const jose = await original<typeof import('jose')>();
  return { ...jose, createRemoteJWKSet: () => jose.createLocalJWKSet(keyset) };
});
let privateKey: CryptoKey;
const env = {
  ENVIRONMENT: 'production',
  PUBLIC_ORIGIN: 'https://www.lzzhu.net',
  ACCESS_ISSUER: 'https://audit.cloudflareaccess.com',
  ACCESS_AUD: 'studio-audience',
  ADMIN_EMAILS: 'owner@example.com',
  BUILD_SERVICE_ID: 'build-service',
  CSRF_SECRET: 'test-only-'.repeat(8),
  REWARDS_ACCESS_AUD: 'recipient-audience',
  REWARDS_EMAILS: 'recipient@example.com',
} as Env;
beforeAll(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  keyset.keys.push({ ...(await exportJWK(keys.publicKey)), kid: 'test-key' });
});
async function token(claims: Record<string, unknown> = {}) {
  return new SignJWT({ email: 'owner@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(String(claims.iss || env.ACCESS_ISSUER))
    .setAudience(String(claims.aud || env.ACCESS_AUD))
    .setIssuedAt()
    .setExpirationTime(typeof claims.exp === 'number' ? claims.exp : '5m')
    .sign(privateKey);
}
async function request(claims = {}, path = '/admin/') {
  return new Request(env.PUBLIC_ORIGIN + path, {
    headers: { 'Cf-Access-Jwt-Assertion': await token(claims) },
  });
}
describe('signed Access assertions and authorization', () => {
  it('protects both recipient reads and writes before accessing private storage', async () => {
    for (const method of ['GET', 'POST']) {
      for (const assertion of ['', await token()]) {
        const response = await rewards.request(
          env.PUBLIC_ORIGIN + '/api/rewards',
          { method, headers: { 'Cf-Access-Jwt-Assertion': assertion, Origin: env.PUBLIC_ORIGIN } },
          env,
        );
        expect(response.status).toBe(401);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
      }
    }
  });
  it('requires a recipient assertion and rejects admin/build tokens from the other application', async () => {
    expect(await identifyRecipient(env, await request())).toBeNull();
    expect(
      await identifyRecipient(
        env,
        await request({ email: 'recipient@example.com', aud: env.REWARDS_ACCESS_AUD }),
      ),
    ).toBe('recipient@example.com');
    expect(
      await identifyRecipient(
        env,
        await request({ email: 'stranger@example.com', aud: env.REWARDS_ACCESS_AUD }),
      ),
    ).toBeNull();
    expect(
      await identifyRecipient(
        env,
        await request({ email: undefined, common_name: env.BUILD_SERVICE_ID, aud: env.REWARDS_ACCESS_AUD }),
      ),
    ).toBeNull();
    expect(await identifyRecipient(env, new Request(env.PUBLIC_ORIGIN + '/api/rewards'))).toBeNull();
  });
  it('accepts an allowlisted editor and the separate build identity', async () => {
    expect(await identify(env, await request())).toEqual({
      id: 'owner@example.com',
      role: 'editor',
      local: false,
    });
    expect(await identify(env, await request({ email: undefined, common_name: 'build-service' }))).toEqual({
      id: 'build-service',
      role: 'build',
      local: false,
    });
  });
  it.each([
    { iss: 'https://other.cloudflareaccess.com' },
    { aud: 'another-application' },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { email: 'stranger@example.com' },
  ])('rejects invalid claims %j', async (claims) => {
    expect(await identify(env, await request(claims))).toBeNull();
  });
  it('rejects a forged signature', async () => {
    const value = await token();
    const pieces = value.split('.');
    pieces[2] = (pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1);
    expect(
      await identify(
        env,
        new Request(env.PUBLIC_ORIGIN + '/admin/', {
          headers: { 'Cf-Access-Jwt-Assertion': pieces.join('.') },
        }),
      ),
    ).toBeNull();
  });
  it('limits build credentials and verifies editor writes', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authenticate);
    app.all('*', (c) => c.json({ ok: true }));
    const build = await token({ email: undefined, common_name: 'build-service' });
    const headers = { 'Cf-Access-Jwt-Assertion': build };
    expect((await app.request(env.PUBLIC_ORIGIN + '/admin/api/content', { headers }, env)).status).toBe(403);
    expect(
      (await app.request(env.PUBLIC_ORIGIN + '/admin/api/releases/abc-123/snapshot', { headers }, env))
        .status,
    ).toBe(200);
    const editor = await token();
    const csrf = await csrfToken(env, { id: 'owner@example.com', role: 'editor', local: false });
    for (const origin of ['https://attacker.example', env.PUBLIC_ORIGIN]) {
      const response = await app.request(
        env.PUBLIC_ORIGIN + '/admin/api/content',
        {
          method: 'PUT',
          headers: { 'Cf-Access-Jwt-Assertion': editor, Origin: origin, 'X-CSRF-Token': csrf },
        },
        env,
      );
      expect(response.status).toBe(origin === env.PUBLIC_ORIGIN ? 200 : 403);
    }
  });
});
