import type { Env } from '../types';

export class FirebaseCardError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 409 | 429 | 503 = 503,
  ) {
    super(message);
  }
}

export function firebaseConfig(env: Env) {
  if (
    env.FIREBASE_CARD_ENABLED !== '1' ||
    env.FIREBASE_PROJECT_ID !== 'card-84e16' ||
    env.FIREBASE_DATABASE_URL !== 'https://card-84e16-default-rtdb.asia-southeast1.firebasedatabase.app' ||
    !env.FIREBASE_SERVICE_ACCOUNT ||
    !env.FIREBASE_WEB_API_KEY ||
    !env.FIREBASE_ADMIN_EMAIL ||
    !env.FIREBASE_ADMIN_UID
  )
    throw new FirebaseCardError('申请卡尚未完成连接，请稍后再试');
  return {
    project: env.FIREBASE_PROJECT_ID,
    database: env.FIREBASE_DATABASE_URL,
    serviceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    apiKey: env.FIREBASE_WEB_API_KEY,
    adminEmail: env.FIREBASE_ADMIN_EMAIL,
    adminUid: env.FIREBASE_ADMIN_UID,
  };
}

/** Fixed service URLs only; never include upstream error bodies or credentials in errors. */
export async function firebaseFetch(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch {
    throw new FirebaseCardError('暂时无法连接，请稍后重试');
  }
}
