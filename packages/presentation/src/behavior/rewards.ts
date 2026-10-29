import { initFirebaseAdmin } from './firebase-admin';
export type CardState = { remaining: number; revision: number; requests: { text: string }[] };
export function initRewards(root: HTMLElement) {
  if (root.dataset.preview === 'true') return () => {};
  const abort = new AbortController();
  const firebase = root.dataset.provider === 'firebase';
  let current: CardState | undefined;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const status = root.querySelector<HTMLElement>('[data-rewards-status]')!;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  let requestId = crypto.randomUUID();
  let previous = '';
  const show = (state: CardState) => {
    current = state;
    root.querySelector('[data-rewards-balance]')!.textContent = String(state.remaining);
    const history = root.querySelector('[data-rewards-history]')!;
    history.replaceChildren(
      ...state.requests.map((request) => {
        const li = document.createElement('li');
        li.textContent = request.text;
        return li;
      }),
    );
  };
  const error = (message: string) => {
    status.hidden = false;
    status.textContent = message;
  };
  const request = async (init?: RequestInit) => {
    const response = await fetch(firebase ? '/api/firebase-card' : '/api/rewards', {
      ...init,
      signal: abort.signal,
      cache: 'no-store',
    });
    if (
      [401, 403].includes(response.status) ||
      !response.headers.get('Content-Type')?.includes('application/json')
    )
      throw new Error(firebase ? '暂时无法连接申请卡，请稍后重试' : '请刷新页面，以指定收件人身份重新登录');
    const body = (await response.json()) as CardState & { error?: string };
    if (!response.ok) throw new Error(body.error || '请求失败');
    show(body);
  };
  request().catch((e) => {
    if (e.name !== 'AbortError')
      error(
        e.message === '请刷新页面，以指定收件人身份重新登录' ? e.message : '暂时无法读取次数，请稍后刷新',
      );
  });
  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      button.disabled = true;
      const input = form.elements.namedItem('request') as HTMLInputElement;
      if (input.value !== previous) {
        requestId = crypto.randomUUID();
        previous = input.value;
      }
      try {
        await request({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: requestId, request: input.value }),
        });
        form.reset();
        previous = '';
        requestId = crypto.randomUUID();
        error('申请已提交');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') error((e as Error).message);
      } finally {
        button.disabled = false;
      }
    },
    { signal: abort.signal },
  );
  const cleanupAdmin = firebase
    ? initFirebaseAdmin(
        root,
        () => current,
        show,
        () => request(),
        abort.signal,
      )
    : () => {};
  return () => {
    cleanupAdmin();
    abort.abort();
  };
}
