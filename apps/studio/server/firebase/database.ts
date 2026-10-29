import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { sha256, type Env } from '../types';
import { firebaseConfig, firebaseFetch, FirebaseCardError } from './config';

const accountSchema = z.object({
  project_id: z.string(),
  client_email: z.string().email(),
  private_key: z.string().startsWith('-----BEGIN PRIVATE KEY-----'),
});
// Preserve the existing RTDB layout and any unrelated fields. Never replace a malformed database with defaults.
export const firebaseStateSchema = z
  .object({
    remainingCount: z.number().int().min(0).max(100000),
    requests: z
      .record(z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), z.string().max(10000))
      .nullable()
      .optional(),
    revision: z.number().int().nonnegative().default(0),
  })
  .passthrough();
export type FirebaseState = z.infer<typeof firebaseStateSchema>;
let cachedToken: { key: string; value: string; expires: number } | undefined;

async function accessToken(env: Env) {
  const config = firebaseConfig(env);
  const key = await sha256(config.serviceAccount);
  if (cachedToken?.key === key && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  let account: z.infer<typeof accountSchema>;
  try {
    account = accountSchema.parse(JSON.parse(config.serviceAccount));
  } catch {
    throw new FirebaseCardError('申请卡服务凭据尚未配置完成');
  }
  if (account.project_id !== config.project) throw new FirebaseCardError('申请卡服务凭据不匹配');
  let assertion: string;
  try {
    assertion = await new SignJWT({
      scope:
        'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(await importPKCS8(account.private_key, 'RS256'));
  } catch {
    throw new FirebaseCardError('申请卡服务凭据无效');
  }
  const response = await firebaseFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new FirebaseCardError('申请卡服务验证失败');
  const token = z
    .object({ access_token: z.string().min(1), expires_in: z.number().positive() })
    .safeParse(await response.json());
  if (!token.success) throw new FirebaseCardError('申请卡服务验证失败');
  cachedToken = {
    key,
    value: token.data.access_token,
    expires: Date.now() + Math.min(token.data.expires_in, 3600) * 1000,
  };
  return cachedToken.value;
}

async function databaseRequest(env: Env, init?: RequestInit) {
  const config = firebaseConfig(env);
  return firebaseFetch(config.database + '/.json', {
    ...init,
    headers: { Authorization: 'Bearer ' + (await accessToken(env)), ...init?.headers },
  });
}

export async function readFirebaseState(env: Env) {
  const response = await databaseRequest(env, { headers: { 'X-Firebase-ETag': 'true' } });
  if (!response.ok) throw new FirebaseCardError('暂时无法读取申请卡');
  const raw = await response.text();
  if (raw.length > 2000000) throw new FirebaseCardError('申请记录需要归档，请联系管理员');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new FirebaseCardError('申请卡数据格式异常');
  }
  const parsed = firebaseStateSchema.safeParse(value);
  const etag = response.headers.get('etag');
  if (!parsed.success || !etag) throw new FirebaseCardError('申请卡数据格式异常');
  return { state: parsed.data, etag };
}

/** ETag compare-and-swap updates balance and history together, including concurrent submissions. */
export async function changeFirebaseState(env: Env, change: (current: FirebaseState) => FirebaseState) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, etag } = await readFirebaseState(env);
    const next = change(state);
    if (next === state) return state;
    const body = JSON.stringify(firebaseStateSchema.parse(next));
    if (body.length > 2000000) throw new FirebaseCardError('申请记录需要归档，请联系管理员');
    const result = await databaseRequest(env, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body,
    });
    if (result.status === 412) continue;
    if (!result.ok) throw new FirebaseCardError('暂时无法保存，请稍后重试');
    return next;
  }
  throw new FirebaseCardError('记录刚刚发生变化，请重试', 409);
}

export function submitFirebaseRequest(state: FirebaseState, id: string, request: string): FirebaseState {
  const records = state.requests || {};
  if (Object.hasOwn(records, id)) {
    if (records[id] !== request) throw new FirebaseCardError('此申请编号已使用，请刷新后重试', 409);
    return state;
  }
  if (state.remainingCount <= 0) throw new FirebaseCardError('剩余次数不足', 409);
  if (Object.keys(records).length >= 10000) throw new FirebaseCardError('申请记录需要归档，请联系管理员');
  return {
    ...state,
    remainingCount: state.remainingCount - 1,
    revision: state.revision + 1,
    requests: { ...records, [id]: request },
  };
}

export function publicFirebaseState(state: FirebaseState) {
  return {
    remaining: state.remainingCount,
    revision: state.revision,
    requests: Object.entries(state.requests || {}).map(([id, text]) => ({ id, text })),
  };
}
