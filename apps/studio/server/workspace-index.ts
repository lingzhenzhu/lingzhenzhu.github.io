import {
  workspaceIssues,
  WORKSPACE_BYTES,
  RESOURCE_BYTES,
  type ResourceChange,
} from '@lzzhu/content/resources';
import type { Page } from '@lzzhu/content';
import type { Env } from './types';
type Metadata = {
  key: string;
  revision: number;
  bytes: number;
  id: string | null;
  path: string | null;
  status: string | null;
  title: string | null;
  pageOrder: string | null;
};
/** Routine saves read identities, versions and byte counts; unrelated page bodies never enter the Worker. */
export async function workspaceIndex(env: Env) {
  const result = await env.DB.batch([
    env.DB.prepare('SELECT revision FROM workspace WHERE id=1'),
    env.DB.prepare(
      "SELECT key,revision,coalesce(length(CAST(document AS BLOB)),0) AS bytes,json_extract(document,'$.id') AS id,json_extract(document,'$.path') AS path,json_extract(document,'$.status') AS status,json_extract(document,'$.title') AS title,CASE WHEN key='pageOrder' THEN document ELSE NULL END AS pageOrder FROM content_resources",
    ),
  ]);
  const state = result[0].results[0] as { revision: number } | undefined;
  if (!state) return null;
  const rows = result[1].results as Metadata[];
  return {
    revision: state.revision,
    rows,
    resourceVersions: Object.fromEntries(rows.map((row) => [row.key, row.revision])),
    pages: rows.filter((row) => row.key.startsWith('page:') && row.id !== null),
  };
}
export function validateWorkspaceChange(
  index: NonNullable<Awaited<ReturnType<typeof workspaceIndex>>>,
  changes: ResourceChange[],
) {
  const next = new Map(index.rows.map((row) => [row.key, row]));
  for (const change of changes) {
    const json = change.value === null ? null : JSON.stringify(change.value);
    const bytes = json ? new TextEncoder().encode(json).byteLength : 0;
    if (bytes > RESOURCE_BYTES)
      throw new Error(
        'This page or collection exceeds its 1.8 MB limit. Split it into smaller pages before saving.',
      );
    const page = change.key.startsWith('page:') ? (change.value as Page | null) : null;
    next.set(change.key, {
      key: change.key,
      revision: 0,
      bytes,
      id: page?.id ?? null,
      path: page?.path ?? null,
      status: page?.status ?? null,
      title: page?.title ?? null,
      pageOrder: change.key === 'pageOrder' ? json : null,
    });
  }
  const pages = [...next.values()].filter((row) => row.key.startsWith('page:') && row.id !== null);
  const order = JSON.parse(next.get('pageOrder')?.pageOrder || 'null') as string[] | null;
  const ids = new Set(pages.map((page) => page.id));
  if (!order || order.length !== pages.length || order.some((id) => !ids.has(id)))
    throw new Error('Page order and page records do not match');
  const issues = workspaceIssues(
    pages.map((page) => ({ id: page.id!, path: page.path!, status: page.status! })),
  );
  if (issues.length) throw new Error(issues.join('; '));
  // Page-order IDs make this slightly more conservative than a full JSON export.
  if ([...next.values()].reduce((total, row) => total + row.bytes, 100) > WORKSPACE_BYTES)
    throw new Error(
      'The workspace exceeds its 8 MB editorial limit. Archive unused drafts before adding more content.',
    );
}
