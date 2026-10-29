import { z } from 'zod';
import {
  ContentSchema,
  PageSchema,
  SettingsSchema,
  NewsSchema,
  MediumSchema,
  type Content,
  type Page,
} from './index';

import { RESOURCE_BYTES } from './limits';
export { RESOURCE_BYTES, WORKSPACE_BYTES } from './limits';
export { workspaceIssues } from './workspace-structure';
export const resourceKey = z.string().regex(/^(settings|news|medium|pageOrder|page:[a-zA-Z0-9_-]{1,100})$/);
export type ResourceKey = z.infer<typeof resourceKey>;
export type ResourceValue =
  Content['settings'] | Content['news'] | Content['medium'] | Page | string[] | null;
export type ResourceChange = { key: ResourceKey; value: ResourceValue };
export type ResourceVersion = ResourceChange & { revision: number };
export type VersionMap = Record<string, number>;
export type WorkspaceSnapshot = Content & { resourceVersions: VersionMap };
export const ChangeRequestSchema = z
  .object({
    mutationId: z.uuid(),
    baseRevision: z.number().int().nonnegative(),
    changes: z
      .array(
        z.object({
          key: resourceKey,
          expectedRevision: z.number().int().nonnegative().nullable(),
          value: z.unknown(),
        }),
      )
      .min(1)
      .max(2004),
  })
  .refine(
    (value) => new Set(value.changes.map((change) => change.key)).size === value.changes.length,
    'Duplicate resource keys',
  );
export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;
export type ChangeResponse = { revision: number; commitRevision: number; changes: ResourceVersion[] };

/** Resource schemas and limits are enforced on every write, including imports. */
export function parseResource(key: string, value: unknown): ResourceValue {
  resourceKey.parse(key);
  if (new TextEncoder().encode(JSON.stringify(value) ?? '').byteLength > RESOURCE_BYTES)
    throw new Error('This page or shared collection exceeds the 1.8 MB limit. Split it into smaller pages.');
  if (key.startsWith('page:')) {
    if (value === null) return null;
    const page = PageSchema.parse(value);
    if (key !== 'page:' + page.id) throw new Error('Page identity does not match its resource key');
    return page;
  }
  if (key === 'settings') return SettingsSchema.parse(value);
  if (key === 'news') return z.array(NewsSchema).max(10000).parse(value);
  if (key === 'medium') return z.array(MediumSchema).max(1000).parse(value);
  return z
    .array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/))
    .max(2000)
    .refine((ids) => new Set(ids).size === ids.length, 'Page order contains duplicates')
    .parse(value);
}

export function resources(content: Content): Map<string, ResourceValue> {
  return new Map<string, ResourceValue>([
    ['settings', content.settings],
    ['news', content.news],
    ['medium', content.medium],
    ['pageOrder', content.pages.map((page) => page.id)],
    ...content.pages.map((page) => ['page:' + page.id, page] as [string, Page]),
  ]);
}
export function sameResource(
  key: string,
  left: ResourceValue | undefined,
  right: ResourceValue | undefined,
): boolean {
  if (left === right) return true;
  // Acknowledgements change the page version, not its editorial content.
  const canonical = (value: ResourceValue | undefined) =>
    key.startsWith('page:') && value ? { ...value, revision: 0 } : (value ?? null);
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
export function diffResources(before: Content, after: Content): ResourceChange[] {
  const a = resources(before),
    b = resources(after);
  return [...new Set([...a.keys(), ...b.keys()])]
    .filter((key) => !sameResource(key, a.get(key), b.get(key)))
    .map((key) => ({ key, value: b.get(key) ?? null }));
}
export function composeResources(values: Map<string, ResourceValue>, revision: number): Content {
  const ids = values.get('pageOrder') as string[];
  if (!ids) throw new Error('Page order is missing');
  const activePages = [...values].filter(([key, value]) => key.startsWith('page:') && value !== null);
  if (activePages.length !== ids.length || ids.some((id) => !values.get('page:' + id)))
    throw new Error('Page order and page records do not match');
  return {
    schemaVersion: 1,
    revision,
    settings: values.get('settings') as Content['settings'],
    news: values.get('news') as Content['news'],
    medium: values.get('medium') as Content['medium'],
    pages: ids.map((id) => values.get('page:' + id) as Page),
  };
}
export function applyResources(
  content: Content,
  changes: ResourceChange[],
  revision = content.revision,
): Content {
  const next = resources(content);
  for (const change of changes) next.set(change.key, change.value);
  return composeResources(next, revision);
}
export function validateResources(values: Map<string, ResourceValue>, revision: number) {
  return ContentSchema.parse(composeResources(values, revision));
}

export type HistoryEntry = { before: ResourceChange[]; after: ResourceChange[] };
export function historyEntry(before: Content, after: Content): HistoryEntry {
  const old = resources(before),
    changes = diffResources(before, after);
  return {
    before: changes.map((change) => ({ key: change.key, value: old.get(change.key) ?? null })),
    after: changes,
  };
}
/** Merge an acknowledgement without discarding typing that happened while the request was in flight. */
export function mergeAcknowledgement(
  base: Content,
  captured: Content,
  current: Content,
  versions: VersionMap,
  response: ChangeResponse,
) {
  const pending = diffResources(captured, current);
  const capturedChanges = new Set(diffResources(base, captured).map((change) => change.key));
  const conflicts = pending.filter((change) =>
    response.changes.some(
      (remote) =>
        remote.key === change.key &&
        (!capturedChanges.has(change.key) || remote.revision > response.commitRevision),
    ),
  );
  // Keep conflicted local resources paired with their original version. The next save must reject them.
  const conflictKeys = new Set(conflicts.map((change) => change.key));
  const nextVersions = { ...versions };
  for (const remote of response.changes)
    if (!conflictKeys.has(remote.key)) nextVersions[remote.key] = remote.revision;
  const saved = applyResources(base, response.changes, response.revision);
  // A conflicting page addition/deletion also affects pageOrder. Keep the coherent
  // local draft until an explicit reload instead of combining incompatible membership.
  const next = conflicts.length
    ? { ...current, revision: response.revision }
    : applyResources(saved, pending, response.revision);
  return { saved, current: next, versions: nextVersions, conflicts: [...conflictKeys] };
}
