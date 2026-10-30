import type { CardState } from './rewards';

export function initFirebaseAdmin(
  root: HTMLElement,
  current: () => CardState | undefined,
  show: (state: CardState) => void,
  refresh: () => Promise<void>,
  signal: AbortSignal,
) {
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const panel = query<HTMLElement>('[data-card-admin]');
  const clearDialog = query<HTMLDialogElement>('[data-card-clear-dialog]');
  const passwordForm = query<HTMLFormElement>('[data-card-password]');
  const password = passwordForm.elements.namedItem('password') as HTMLInputElement;
  let busy = false;
  let clearRevision: number | undefined;
  const session = (authenticated: boolean) => {
    panel.hidden = authenticated === false;
    passwordForm.hidden = authenticated;
  };
  const api = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const response = await fetch('/api/firebase-card' + path, {
      method,
      cache: 'no-store',
      signal,
      credentials: 'same-origin',
      ...(body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });
    if (!response.headers.get('Content-Type')?.includes('application/json'))
      throw new Error('暂时无法连接，请稍后重试');
    const value = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      if (response.status === 401) session(false);
      if (response.status === 409) await refresh().catch(() => {});
      throw new Error(value.error || '操作未完成，请重试');
    }
    return value;
  };
  const run = async (statusSelector: string, action: () => Promise<void>, focusAfter?: HTMLElement) => {
    if (busy) return;
    busy = true;
    const controls = [
      ...root.querySelectorAll<HTMLButtonElement>(
        '[data-card-admin] button, [data-card-password] button, dialog button',
      ),
    ];
    controls.forEach((button) => {
      button.disabled = true;
    });
    const status = query<HTMLElement>(statusSelector);
    status.textContent = '';
    let completed = false;
    try {
      await action();
      completed = true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') status.textContent = (error as Error).message;
    } finally {
      busy = false;
      controls.forEach((button) => {
        button.disabled = false;
      });
    }
    if (completed) focusAfter?.focus();
  };
  api<{ authenticated: boolean }>('/session')
    .then(async (data) => {
      session(data.authenticated);
      if (data.authenticated) await refresh();
    })
    .catch(() => session(false));
  clearDialog
    .querySelector('[data-card-cancel]')!
    .addEventListener('click', () => clearDialog.close(), { signal });
  passwordForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void run(
        '[data-card-login-status]',
        async () => {
          try {
            await api('/session', 'POST', { password: password.value });
          } finally {
            password.value = '';
          }
          await refresh();
          session(true);
        },
        query('[data-card-action="increase"]'),
      );
    },
    { signal },
  );
  for (const control of root.querySelectorAll<HTMLButtonElement>('[data-card-action]')) {
    control.addEventListener(
      'click',
      () => {
        void run('[data-card-admin-status]', async () => {
          const state = current();
          if (!state) throw new Error('请等待次数读取完成');
          const remaining =
            control.dataset.cardAction === 'increase'
              ? state.remaining + 1
              : control.dataset.cardAction === 'decrease'
                ? Math.max(0, state.remaining - 1)
                : 2;
          show(
            await api<CardState>('/admin/balance', 'PUT', { remaining, expectedRevision: state.revision }),
          );
          query<HTMLElement>('[data-card-admin-status]').textContent = '次数已保存';
        });
      },
      { signal },
    );
  }
  query('[data-card-clear]').addEventListener(
    'click',
    () => {
      clearRevision = current()?.revision;
      query<HTMLElement>('[data-card-clear-status]').textContent = '';
      // Safari does not focus buttons on pointer clicks; give the dialog a return target.
      query('[data-card-clear]').focus();
      clearDialog.showModal();
    },
    { signal },
  );
  query('[data-card-confirm-clear]').addEventListener(
    'click',
    () => {
      void run(
        '[data-card-clear-status]',
        async () => {
          if (clearRevision === undefined) throw new Error('请等待记录读取完成');
          show(await api<CardState>('/admin/requests', 'DELETE', { expectedRevision: clearRevision }));
          clearDialog.close();
          query<HTMLElement>('[data-card-admin-status]').textContent = '记录已清空';
        },
        query('[data-card-clear]'),
      );
    },
    { signal },
  );
  query('[data-card-logout]').addEventListener(
    'click',
    () => {
      void run(
        '[data-card-admin-status]',
        async () => {
          await api('/session', 'DELETE');
          session(false);
          password.value = '';
        },
        password,
      );
    },
    { signal },
  );
  return () => {
    password.value = '';
    clearDialog.close();
  };
}
