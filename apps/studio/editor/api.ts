let csrf = '';
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  if (init.method && !['GET', 'HEAD'].includes(init.method)) headers.set('X-CSRF-Token', csrf);
  const response = await fetch('/admin/api' + path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  // Cloudflare Access may return its HTML login screen when a session expires.
  // Keep the draft intact and show an actionable message instead of a JSON syntax error.
  if (
    response.status === 401 ||
    response.redirected ||
    !response.headers.get('content-type')?.includes('application/json')
  )
    throw new Error(
      response.status >= 500
        ? 'The server is unavailable. Your unsaved draft is still here. Try again shortly.'
        : 'Your session needs attention. Sign in at /admin/ in another tab, then try saving again. Your unsaved draft is still here.',
    );
  const body = (await response.json()) as T & { error?: string; csrf?: string };
  if (!response.ok) throw new Error(body.error || 'Request failed: ' + response.status);
  if (body.csrf) csrf = body.csrf;
  return body;
}
export const send = <T>(path: string, body: unknown, method = 'POST') =>
  api<T>(path, { method, body: JSON.stringify(body) });
