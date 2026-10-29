import type { CardState } from './rewards';

export function initFirebaseAdmin(
  root: HTMLElement,
  current: () => CardState | undefined,
  show: (state: CardState) => void,
  refresh: () => Promise<void>,
  signal: AbortSignal,
) {
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const login = query<HTMLButtonElement>('[data-card-login]');
  const panel = query<HTMLElement>('[data-card-admin]');
  const passwordDialog = query<HTMLDialogElement>('[data-card-password-dialog]');
  const clearDialog = query<HTMLDialogElement>('[data-card-clear-dialog]');
  const passwordForm = query<HTMLFormElement>('[data-card-password]');
  const password = passwordForm.elements.namedItem('password') as HTMLInputElement;
  const balanceForm = query<HTMLFormElement>('[data-card-balance]');
  const amount = balanceForm.elements.namedItem('remaining') as HTMLInputElement;
  let busy = false;
  let clearRevision: number | undefined;
  const session = (authenticated: boolean) => {
    panel.hidden = authenticated === false;
    login.hidden = authenticated;
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
  const run = async (statusSelector: string, action: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    const controls = [...root.querySelectorAll<HTMLButtonElement>('[data-card-admin] button, dialog button')];
    controls.forEach((button) => {
      button.disabled = true;
    });
    const status = query<HTMLElement>(statusSelector);
    status.textContent = '';
    try {
      await action();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') status.textContent = (error as Error).message;
    } finally {
      busy = false;
      controls.forEach((button) => {
        button.disabled = false;
      });
    }
  };
  api<{ authenticated: boolean }>('/session')
    .then(async (data) => {
      session(data.authenticated);
      if (data.authenticated) {
        await refresh();
        amount.value = String(current()!.remaining);
      }
    })
    .catch(() => session(false));
  login.addEventListener(
    'click',
    () => {
      password.value = '';
      query<HTMLElement>('[data-card-login-status]').textContent = '';
      passwordDialog.showModal();
      password.focus();
    },
    { signal },
  );
  for (const dialog of [passwordDialog, clearDialog]) {
    dialog.querySelector('[data-card-cancel]')!.addEventListener('click', () => dialog.close(), { signal });
  }
  passwordDialog.addEventListener(
    'close',
    () => {
      password.value = '';
    },
    { signal },
  );
  passwordForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void run('[data-card-login-status]', async () => {
        try {
          await api('/session', 'POST', { password: password.value });
        } finally {
          password.value = '';
        }
        await refresh();
        amount.value = String(current()!.remaining);
        session(true);
        passwordDialog.close();
        amount.focus();
      });
    },
    { signal },
  );
  balanceForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void run('[data-card-admin-status]', async () => {
        if (!current()) throw new Error('请等待次数读取完成');
        const value = await api<CardState>('/admin/balance', 'PUT', {
          remaining: Number(amount.value),
          expectedRevision: current()!.revision,
        });
        show(value);
        query<HTMLElement>('[data-card-admin-status]').textContent = '次数已保存';
      });
    },
    { signal },
  );
  query('[data-card-clear]').addEventListener(
    'click',
    () => {
      clearRevision = current()?.revision;
      query<HTMLElement>('[data-card-clear-status]').textContent = '';
      clearDialog.showModal();
    },
    { signal },
  );
  query('[data-card-confirm-clear]').addEventListener(
    'click',
    () => {
      void run('[data-card-clear-status]', async () => {
        if (clearRevision === undefined) throw new Error('请等待记录读取完成');
        show(await api<CardState>('/admin/requests', 'DELETE', { expectedRevision: clearRevision }));
        clearDialog.close();
        query<HTMLElement>('[data-card-admin-status]').textContent = '记录已清空';
      });
    },
    { signal },
  );
  query('[data-card-logout]').addEventListener(
    'click',
    () => {
      void run('[data-card-admin-status]', async () => {
        await api('/session', 'DELETE');
        session(false);
        login.focus();
      });
    },
    { signal },
  );
  return () => {
    password.value = '';
    passwordDialog.close();
    clearDialog.close();
  };
}
