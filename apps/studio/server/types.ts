export interface Env {
  DB: D1Database;
  PRIVATE: R2Bucket;
  ASSETS: Fetcher;
  IMAGES: ImagesBinding;
  ENVIRONMENT: string;
  LOCAL_DEV_AUTH?: string;
  PUBLIC_ORIGIN: string;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  REWARDS_ACCESS_AUD: string;
  REWARDS_EMAILS: string;
  ADMIN_EMAILS: string;
  BUILD_SERVICE_ID: string;
  CSRF_SECRET: string;
  GITHUB_REPOSITORY: string;
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_PRIVATE_KEY: string;
  SOURCE_COMMIT: string;
  TURNSTILE_SECRET?: string;
}
export type Identity = { id: string; role: 'editor' | 'build'; local: boolean };
export type AppEnv = {
  Bindings: Env;
  Variables: { identity: Identity; imageOrigins?: string[]; isolatedImage?: boolean };
};
export interface Release {
  id: string;
  sequence: number;
  base_id: string | null;
  content_revision: number;
  source_commit: string;
  status: string;
  snapshot_hash: string;
  created_at: string;
  created_by: string;
  error: string | null;
  run_id: string | null;
  artifact_hash: string | null;
}
export async function sha256(value: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, '0')).join('');
}
