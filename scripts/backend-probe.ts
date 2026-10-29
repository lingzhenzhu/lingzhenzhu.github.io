import fs from 'node:fs/promises';
const origin = 'https://www.lzzhu.net';
const checks = [];
for (const pathname of [
  '/',
  '/admin',
  '/admin/',
  '/admin/api/content',
  '/admin/api/assets',
  '/woaidumuyibeizi/',
  '/api/rewards',
  '/api/medium',
  '/_release.json',
]) {
  try {
    const response = await fetch(origin + pathname, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const privateRoute =
      pathname.startsWith('/admin') || ['/woaidumuyibeizi/', '/api/rewards'].includes(pathname);
    const location = response.headers.get('location');
    const login = !!location && new URL(location, origin).hostname.endsWith('.cloudflareaccess.com');
    checks.push({
      pathname,
      status: response.status,
      authenticationBoundary: privateRoute
        ? response.status === 401 || response.status === 403 || (response.status === 302 && login)
        : null,
      cache: response.headers.get('cache-control'),
      csp: response.headers.has('content-security-policy'),
      // Redirect targets may contain login state: never record them.
    });
    await response.body?.cancel();
  } catch (error) {
    checks.push({ pathname, error: error instanceof Error ? error.message : 'Unavailable' });
  }
}
await fs.mkdir('.artifacts/backend', { recursive: true });
await fs.writeFile(
  '.artifacts/backend/anonymous-probe.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2),
);
console.log(checks);
if (checks.some((check) => check.error || check.authenticationBoundary === false)) process.exitCode = 1;
