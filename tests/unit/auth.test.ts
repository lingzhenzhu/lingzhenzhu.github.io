import { describe, it, expect } from 'vitest';
import { identify, localDevelopment, sameSecret } from '../../apps/studio/server/auth';
import type { Env } from '../../apps/studio/server/types';
describe('Access origin and local bypass boundary', () => {
  const env = {
    ENVIRONMENT: 'production',
    LOCAL_DEV_AUTH: '1',
    PUBLIC_ORIGIN: 'https://www.lzzhu.net',
    ACCESS_ISSUER: '',
    ACCESS_AUD: '',
  } as Env;
  it('fails closed in production with no Access assertion/configuration', async () => {
    expect(await identify(env, new Request('https://www.lzzhu.net/admin/'))).toBeNull();
    expect(await identify(env, new Request('http://127.0.0.1/admin/'))).toBeNull();
  });
  it('requires all local switches AND a loopback hostname', () => {
    expect(localDevelopment({ ...env, ENVIRONMENT: 'local' }, new URL('http://127.0.0.1:8787/admin/'))).toBe(
      true,
    );
    expect(localDevelopment({ ...env, ENVIRONMENT: 'local' }, new URL('https://www.lzzhu.net/admin/'))).toBe(
      false,
    );
    expect(
      localDevelopment(
        { ...env, ENVIRONMENT: 'local', LOCAL_DEV_AUTH: undefined },
        new URL('http://127.0.0.1/admin/'),
      ),
    ).toBe(false);
  });
});
describe('CSRF token comparison', () => {
  it('accepts only the exact token', () => {
    expect(sameSecret('a1b2c3', 'a1b2c3')).toBe(true);
    expect(sameSecret('a1b2c4', 'a1b2c3')).toBe(false);
    expect(sameSecret('a1b2c', 'a1b2c3')).toBe(false);
    expect(sameSecret(undefined, 'a1b2c3')).toBe(false);
    expect(sameSecret('', '')).toBe(true);
  });
});
