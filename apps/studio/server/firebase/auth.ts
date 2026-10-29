import { decodeJwt } from 'jose';
import type { Env } from '../types';
import { firebaseConfig, firebaseFetch, FirebaseCardError } from './config';

async function authRequest(env: Env, action: 'signInWithPassword' | 'lookup', body: unknown) {
  const config = firebaseConfig(env);
  return firebaseFetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:' +
      action +
      '?key=' +
      encodeURIComponent(config.apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function firebaseAdmin(env: Env, token?: string): Promise<boolean> {
  if (!token || token.length > 8000) return false;
  const config = firebaseConfig(env);
  // Firebase's lookup verifies the ID token. Decoded claims below add project, expiry and revocation checks;
  // decoding alone is deliberately never treated as verification.
  const response = await authRequest(env, 'lookup', { idToken: token });
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429)
      throw new FirebaseCardError('暂时无法验证管理员身份');
    return false;
  }
  const body = (await response.json()) as {
    users?: { localId: string; disabled?: boolean; validSince?: string; email?: string }[];
  };
  const user = body.users?.[0];
  if (
    !user ||
    user.localId !== config.adminUid ||
    user.disabled ||
    user.email?.toLowerCase() !== config.adminEmail.toLowerCase()
  )
    return false;
  try {
    const claims = decodeJwt(token);
    return (
      claims.sub === config.adminUid &&
      claims.aud === config.project &&
      claims.iss === 'https://securetoken.google.com/' + config.project &&
      typeof claims.exp === 'number' &&
      claims.exp > Date.now() / 1000 &&
      typeof claims.auth_time === 'number' &&
      claims.auth_time >= Number(user.validSince || 0)
    );
  } catch {
    return false;
  }
}

export async function signInFirebaseAdmin(env: Env, password: string) {
  const config = firebaseConfig(env);
  const response = await authRequest(env, 'signInWithPassword', {
    email: config.adminEmail,
    password,
    returnSecureToken: true,
  });
  if (!response.ok) {
    if (response.status >= 500) throw new FirebaseCardError('暂时无法登录，请稍后重试');
    throw new FirebaseCardError('密码不正确或账号暂不可用', 401);
  }
  const body = (await response.json()) as { localId?: string; idToken?: string };
  if (body.localId !== config.adminUid || !(await firebaseAdmin(env, body.idToken)))
    throw new FirebaseCardError('此账号没有管理员权限', 403);
  return body.idToken!;
}
