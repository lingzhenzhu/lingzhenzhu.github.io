import { afterEach, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ContentSchema, newBlock } from '@lzzhu/content';
import type { ChangeRequest } from '@lzzhu/content/resources';
import { moveSection, copySection } from '../../packages/content/src/operations';
import { seedSql } from '../../packages/content/src/seed';
import { firebaseCard } from '../../apps/studio/server/firebase/routes';
import { firebaseAdmin } from '../../apps/studio/server/firebase/auth';
import { saveChanges, getWorkspace, getRevision } from '../../apps/studio/server/repository';
import {
  publicFirebaseState,
  submitFirebaseRequest,
  type FirebaseState,
} from '../../apps/studio/server/firebase/database';
import { testDatabase } from '../helpers/database';
import type { Env } from '../../apps/studio/server/types';

const source = ContentSchema.parse(JSON.parse(readFileSync('content/site.json', 'utf8')));
const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
});
const opened: ReturnType<typeof testDatabase>[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  opened.splice(0).forEach(({ sqlite }) => sqlite.close());
});
function setup() {
  const db = testDatabase();
  opened.push(db);
  const env = {
    DB: db.DB,
    ENVIRONMENT: 'production',
    PUBLIC_ORIGIN: 'https://www.lzzhu.net',
    CSRF_SECRET: 'test-only-not-a-production-secret',
    FIREBASE_CARD_ENABLED: '1',
    FIREBASE_PROJECT_ID: 'card-84e16',
    FIREBASE_DATABASE_URL: 'https://card-84e16-default-rtdb.asia-southeast1.firebasedatabase.app',
    FIREBASE_ADMIN_EMAIL: 'admin@example.com',
    FIREBASE_ADMIN_UID: 'admin-user',
    FIREBASE_WEB_API_KEY: 'test-api-key',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
      project_id: 'card-84e16',
      client_email: 'test@card-84e16.iam.gserviceaccount.com',
      private_key: key,
    }),
  } as Env;
  let state: FirebaseState = {
    remainingCount: 2,
    requests: { 'old-entry': 'Original record' },
    revision: 0,
    unrelated: { preserve: true },
  };
  let version = 0,
    writes = 0,
    collision = false;
  let disabled = false,
    validSince = '0';
  const claims = {
    sub: 'admin-user',
    aud: 'card-84e16',
    iss: 'https://securetoken.google.com/card-84e16',
    exp: Math.floor(Date.now() / 1000) + 3600,
    auth_time: Math.floor(Date.now() / 1000),
  };
  const token = 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.test-signature';
  const upstream = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token')
      return Response.json({ access_token: 'test-access-token', expires_in: 3600 });
    if (url.includes('accounts:signInWithPassword')) {
      const body = JSON.parse(String(init!.body));
      return body.password === 'test-password'
        ? Response.json({ localId: 'admin-user', idToken: token })
        : Response.json({}, { status: 400 });
    }
    if (url.includes('accounts:lookup')) {
      if (JSON.parse(String(init!.body)).idToken !== token) return Response.json({}, { status: 400 });
      return Response.json({
        users: [{ localId: 'admin-user', email: 'admin@example.com', disabled, validSince }],
      });
    }
    if (url !== env.FIREBASE_DATABASE_URL + '/.json') throw new Error('Unexpected upstream');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-access-token');
    if (init?.method === 'PUT') {
      writes++;
      if (collision) {
        collision = false;
        state = submitFirebaseRequest(state, 'concurrent', 'Another visitor');
        version++;
      }
      if (new Headers(init.headers).get('if-match') !== '"' + version + '"')
        return Response.json(state, { status: 412 });
      state = JSON.parse(String(init.body));
      version++;
    }
    return Response.json(state, { headers: { etag: '"' + version + '"' } });
  });
  vi.stubGlobal('fetch', upstream);
  const request = (path = '', method = 'GET', body?: unknown, headers: Record<string, string> = {}) =>
    firebaseCard.request(
      env.PUBLIC_ORIGIN + '/api/firebase-card' + path,
      {
        method,
        headers: { Origin: env.PUBLIC_ORIGIN, 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      env,
    );
  return {
    ...db,
    env,
    request,
    upstream,
    token,
    claims,
    state: () => state,
    writes: () => writes,
    collide: () => {
      collision = true;
    },
    disable: () => {
      disabled = true;
    },
    revoke: () => {
      validSince = String(claims.auth_time + 1);
    },
  };
}

it('returns only public card fields and denies unconfigured or anonymous administration', async () => {
  const fixture = setup();
  const response = await fixture.request();
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(await response.json()).toEqual(publicFirebaseState(fixture.state()));
  expect(
    (await fixture.request('/admin/balance', 'PUT', { remaining: 999, expectedRevision: 0 })).status,
  ).toBe(401);
  expect((await fixture.request('/admin/requests', 'DELETE', { expectedRevision: 0 })).status).toBe(401);
  fixture.env.FIREBASE_CARD_ENABLED = '0';
  expect((await fixture.request()).status).toBe(503);
  expect(fixture.writes()).toBe(0);
});
it('deduplicates retries, retries concurrent ETag conflicts and never overdraws', async () => {
  const fixture = setup();
  fixture.collide();
  const body = { id: crypto.randomUUID(), request: 'New request' };
  expect((await fixture.request('', 'POST', body)).status).toBe(200);
  expect(fixture.state().remainingCount).toBe(0);
  expect(fixture.state().unrelated).toEqual({ preserve: true });
  expect(Object.keys(fixture.state().requests!)).toHaveLength(3);
  expect((await fixture.request('', 'POST', body)).status).toBe(200);
  expect(fixture.writes()).toBe(2);
  expect((await fixture.request('', 'POST', { ...body, request: 'Changed payload' })).status).toBe(409);
  expect((await fixture.request('', 'POST', { id: crypto.randomUUID(), request: 'Overdraw' })).status).toBe(
    409,
  );
});
it('checks origin, validates input and rate limits password attempts before authentication', async () => {
  const fixture = setup();
  expect(
    (
      await fixture.request(
        '',
        'POST',
        { id: crypto.randomUUID(), request: 'Cross site' },
        { Origin: 'https://other.example' },
      )
    ).status,
  ).toBe(403);
  expect(
    (await fixture.request('', 'POST', { id: crypto.randomUUID(), request: ' ', remainingCount: 100 }))
      .status,
  ).toBe(400);
  for (let i = 0; i < 6; i++)
    expect((await fixture.request('/session', 'POST', { password: 'wrong' })).status).toBe(401);
  expect((await fixture.request('/session', 'POST', { password: 'test-password' })).status).toBe(429);
  expect(fixture.writes()).toBe(0);
});
it('keeps the administrator token in a secure cookie and detects stale updates and revocation', async () => {
  const fixture = setup();
  const login = await fixture.request('/session', 'POST', { password: 'test-password' });
  expect(login.status).toBe(200);
  expect(await login.json()).toEqual({ authenticated: true });
  const cookie = login.headers.get('Set-Cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Strict');
  const headers = { Cookie: cookie.split(';')[0] };
  expect(
    (await fixture.request('/admin/balance', 'PUT', { remaining: 4, expectedRevision: 0 }, headers)).status,
  ).toBe(200);
  expect((await fixture.request('/admin/requests', 'DELETE', { expectedRevision: 0 }, headers)).status).toBe(
    409,
  );
  expect((await fixture.request('/admin/requests', 'DELETE', { expectedRevision: 1 }, headers)).status).toBe(
    200,
  );
  expect(fixture.state().remainingCount).toBe(4);
  expect(fixture.state().requests).toBeNull();
  fixture.revoke();
  expect(await firebaseAdmin(fixture.env, fixture.token)).toBe(false);
  fixture.disable();
  expect(
    (await fixture.request('/admin/balance', 'PUT', { remaining: 100, expectedRevision: 2 }, headers)).status,
  ).toBe(401);
});
it('does not convert corrupted or missing remote data into an empty balance', async () => {
  const fixture = setup();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.includes('oauth2')
        ? Response.json({ access_token: 'test-access-token', expires_in: 3600 })
        : Response.json(null, { headers: { etag: '"null"' } }),
    ),
  );
  expect((await fixture.request()).status).toBe(503);
});
it('enforces the Firebase singleton in saves while permitting an atomic cross-page move and hide', async () => {
  const fixture = setup();
  fixture.sqlite.exec(seedSql(source));
  const page = source.pages.find((p) => p.id === 'request-card')!;
  const block = page.blocks.find((b) => b.type === 'firebaseRewards')!;
  expect(() => newBlock('firebaseRewards')).toThrow('cannot be added');
  expect(() => copySection(source, page.id, block.id, ['home'])).toThrow('cannot be copied');
  const changes: ChangeRequest['changes'] = [
    { key: 'page:' + page.id, expectedRevision: source.revision, value: { ...page, blocks: [] } },
  ];
  await expect(
    saveChanges(
      fixture.env,
      { mutationId: crypto.randomUUID(), baseRevision: source.revision, changes },
      'test',
    ),
  ).rejects.toThrow('only be moved or hidden');
  const moved = moveSection(source, page.id, block.id, 'home');
  const home = moved.pages.find((p) => p.id === 'home')!;
  changes.push({ key: 'page:home', expectedRevision: source.revision, value: home });
  await saveChanges(
    fixture.env,
    { mutationId: crypto.randomUUID(), baseRevision: source.revision, changes },
    'test',
  );
  const saved = (await getWorkspace(fixture.env))!;
  expect(saved.pages.find((p) => p.id === 'home')!.blocks[0]).toEqual(block);
  expect(saved.pages.find((p) => p.id === page.id)!.blocks).toEqual([]);
  for (const hidden of [true, false]) {
    const workspace = (await getWorkspace(fixture.env))!;
    const updated = workspace.pages.find((p) => p.id === 'home')!;
    updated.blocks = updated.blocks.map((b) => (b.type === 'firebaseRewards' ? { ...b, hidden } : b));
    await saveChanges(
      fixture.env,
      {
        mutationId: crypto.randomUUID(),
        baseRevision: workspace.revision,
        changes: [
          { key: 'page:home', expectedRevision: workspace.resourceVersions['page:home'], value: updated },
        ],
      },
      'test',
    );
    const cards = (await getWorkspace(fixture.env))!.pages
      .flatMap((p) => p.blocks)
      .filter((b) => b.type === 'firebaseRewards');
    expect(cards).toHaveLength(1);
    expect(cards[0].hidden).toBe(hidden);
  }
  expect(fixture.upstream).not.toHaveBeenCalled();
});
it('migrates only the existing module in current and historical content without touching Cloudflare balances', async () => {
  const fixture = setup();
  const original = structuredClone(source);
  const page = original.pages.find((p) => p.id === 'request-card')!;
  page.blocks = page.blocks.map((b) =>
    b.type === 'firebaseRewards' ? { ...newBlock('rewards'), id: b.id } : b,
  );
  fixture.sqlite.exec(seedSql(original));
  fixture.sqlite.exec('UPDATE reward_state SET remaining=17 WHERE id=1');
  fixture.sqlite.exec(readFileSync('apps/studio/migrations/0004_firebase_card.sql', 'utf8'));
  expect((await getWorkspace(fixture.env))!.pages).toEqual(source.pages);
  expect((await getRevision(fixture.env, source.revision))!.pages).toEqual(source.pages);
  expect(fixture.sqlite.prepare('SELECT remaining FROM reward_state WHERE id=1').get()!.remaining).toBe(17);
});
