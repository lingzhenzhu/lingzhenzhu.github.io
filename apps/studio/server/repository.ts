import { ContentSchema, type Content } from '@lzzhu/content';
import {
  ChangeRequestSchema,
  parseResource,
  composeResources,
  diffResources,
  type ChangeRequest,
  type ChangeResponse,
  type ResourceValue,
  type WorkspaceSnapshot,
} from '@lzzhu/content/resources';
import { sha256, type Env } from './types';
import { workspaceIndex, validateWorkspaceChange } from './workspace-index';
export class Conflict extends Error {}
export class InvalidContent extends Error {}
type Row = { key: string; revision: number; document: string | null };

/** Batch reads share a SQLite transaction, so the revision and resources describe one point in time. */
export async function getWorkspace(env: Env): Promise<WorkspaceSnapshot | null> {
  const result = await env.DB.batch([
    env.DB.prepare('SELECT revision FROM workspace WHERE id=1'),
    env.DB.prepare('SELECT key,revision,document FROM content_resources'),
  ]);
  const state = result[0].results[0] as { revision: number } | undefined;
  if (!state) return null;
  const rows = result[1].results as Row[];
  const content = ContentSchema.parse(
    composeResources(
      new Map(rows.map((row) => [row.key, row.document === null ? null : JSON.parse(row.document)])),
      state.revision,
    ),
  );
  return { ...content, resourceVersions: Object.fromEntries(rows.map((row) => [row.key, row.revision])) };
}
export async function getContent(env: Env): Promise<Content | null> {
  const result = await getWorkspace(env);
  if (!result) return null;
  const { resourceVersions: _, ...content } = result;
  return content;
}
export async function getRevision(env: Env, revision: number): Promise<Content | null> {
  if (!(await env.DB.prepare('SELECT revision FROM revisions WHERE revision=?').bind(revision).first()))
    return null;
  const rows = (
    await env.DB.prepare(
      'SELECT v.key,v.revision,v.document FROM resource_versions v WHERE v.revision=(SELECT MAX(h.revision) FROM resource_versions h WHERE h.key=v.key AND h.revision<=?)',
    )
      .bind(revision)
      .all<Row>()
  ).results;
  const values = new Map<string, ResourceValue>(
    rows.map((row) => [row.key, row.document === null ? null : JSON.parse(row.document)]),
  );
  // Older snapshots predate tombstones; their page order remains the authoritative membership.
  const ids = new Set(values.get('pageOrder') as string[]);
  for (const key of values.keys()) if (key.startsWith('page:') && !ids.has(key.slice(5))) values.delete(key);
  return ContentSchema.parse(composeResources(values, revision));
}
async function responseSince(env: Env, base: number, commitRevision: number): Promise<ChangeResponse> {
  const result = await env.DB.batch([
    env.DB.prepare('SELECT revision FROM workspace WHERE id=1'),
    env.DB.prepare('SELECT key,revision,document FROM content_resources WHERE revision>?').bind(base),
  ]);
  return {
    revision: (result[0].results[0] as { revision: number }).revision,
    commitRevision,
    changes: (result[1].results as Row[]).map((row) => ({
      key: row.key,
      revision: row.revision,
      value: row.document === null ? null : JSON.parse(row.document),
    })),
  };
}
export async function saveChanges(
  env: Env,
  input: ChangeRequest,
  actor: string,
  expectedWorkspace?: number,
): Promise<ChangeResponse> {
  const request = ChangeRequestSchema.parse(input);
  const hash = await sha256(JSON.stringify({ request, actor }));
  // The same request may be retried after a network failure hid a successful commit.
  const prior = await env.DB.prepare('SELECT revision,request_hash FROM revisions WHERE mutation_id=?')
    .bind(request.mutationId)
    .first<{ revision: number; request_hash: string }>();
  if (prior) {
    if (prior.request_hash !== hash)
      throw new Conflict('This save identifier was already used for a different change.');
    return responseSince(env, request.baseRevision, prior.revision);
  }
  const parsed = request.changes.map((change) => {
    try {
      return { ...change, value: parseResource(change.key, change.value) };
    } catch (error) {
      throw new InvalidContent(error instanceof Error ? error.message : 'Invalid content');
    }
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const committed = await env.DB.prepare('SELECT revision,request_hash FROM revisions WHERE mutation_id=?')
      .bind(request.mutationId)
      .first<{ revision: number; request_hash: string }>();
    if (committed) {
      if (committed.request_hash !== hash)
        throw new Conflict('This save identifier was already used for a different change.');
      return responseSince(env, request.baseRevision, committed.revision);
    }
    const workspace = await workspaceIndex(env);
    if (!workspace) throw new InvalidContent('Database needs initial content');
    if (expectedWorkspace !== undefined && workspace.revision !== expectedWorkspace)
      throw new Conflict('Content changed in another session. Reload before restoring a full snapshot.');
    if (request.baseRevision > workspace.revision)
      throw new InvalidContent('The saved revision is ahead of this database.');
    const conflicts = parsed.filter(
      (change) => (workspace.resourceVersions[change.key] ?? null) !== change.expectedRevision,
    );
    if (conflicts.length) {
      const names = conflicts.map((change) =>
        change.key.startsWith('page:')
          ? workspace.pages.find((page) => 'page:' + page.id === change.key)?.title || 'Deleted page'
          : {
              settings: 'Site settings and contact links',
              pageOrder: 'Page structure',
              news: 'News',
              medium: 'Medium',
            }[change.key] || change.key,
      );
      throw new Conflict(
        names.join(', ') +
          ' changed in another session. Your edits are kept here. Reload the saved version before continuing.',
      );
    }
    const revision = workspace.revision + 1,
      now = new Date().toISOString(),
      token = crypto.randomUUID();
    const changes = parsed.map((change) => ({
      ...change,
      value:
        change.key.startsWith('page:') && change.value
          ? ({ ...change.value, revision } as ResourceValue)
          : change.value,
    }));
    try {
      validateWorkspaceChange(workspace, changes);
    } catch (error) {
      throw new InvalidContent(error instanceof Error ? error.message : 'Invalid page structure');
    }
    const owned = 'EXISTS(SELECT 1 FROM workspace WHERE id=1 AND mutation_id=?)';
    const statements = [
      env.DB.prepare(
        'UPDATE workspace SET revision=?,updated_at=?,updated_by=?,mutation_id=? WHERE id=1 AND revision=?',
      ).bind(revision, now, actor, token, workspace.revision),
      ...changes.flatMap((change) => {
        const document = change.value === null ? null : JSON.stringify(change.value);
        return [
          env.DB.prepare(
            'INSERT INTO content_resources(key,revision,document) SELECT ?,?,? WHERE ' +
              owned +
              ' ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,document=excluded.document',
          ).bind(change.key, revision, document, token),
          env.DB.prepare(
            'INSERT INTO resource_versions(key,revision,document) SELECT ?,?,? WHERE ' + owned,
          ).bind(change.key, revision, document, token),
        ];
      }),
      env.DB.prepare('INSERT INTO revisions SELECT ?,?,?,?,? WHERE ' + owned).bind(
        revision,
        now,
        actor,
        request.mutationId,
        hash,
        token,
      ),
      env.DB.prepare(
        "INSERT INTO audit_log(actor,action,reference,created_at) SELECT ?,'content.save',?,? WHERE " + owned,
      ).bind(actor, String(revision), now, token),
    ];
    const result = await env.DB.batch(statements);
    if (result[0].meta.changes) return responseSince(env, request.baseRevision, revision);
    // A different page may have committed since our read. Re-check only the touched versions.
  }
  throw new Conflict('Several saves arrived together. Retry this save.');
}
/** Explicit snapshot restoration/import remains atomic; routine editing uses saveChanges. */
export async function saveContent(env: Env, value: unknown, expected: number, actor: string) {
  const content = ContentSchema.parse(value),
    current = await getWorkspace(env);
  if (!current || current.revision !== expected)
    throw new Conflict('Content changed in another session. Reload before saving.');
  const changes = diffResources(current, content);
  if (!changes.length) changes.push({ key: 'settings', value: content.settings });
  await saveChanges(
    env,
    {
      mutationId: crypto.randomUUID(),
      baseRevision: expected,
      changes: changes.map((change) => ({
        ...change,
        expectedRevision: current.resourceVersions[change.key] ?? null,
      })),
    },
    actor,
    expected,
  );
  return (await getContent(env))!;
}
export async function audit(env: Env, actor: string, action: string, reference: string) {
  await env.DB.prepare('INSERT INTO audit_log(actor,action,reference,created_at) VALUES(?,?,?,?)')
    .bind(actor, action, reference, new Date().toISOString())
    .run();
}
