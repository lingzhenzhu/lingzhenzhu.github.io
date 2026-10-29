import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { ContentSchema, mergeMedium, type Content } from '@lzzhu/content';
import { SiteShell } from '@lzzhu/presentation';
import { authenticate, csrfToken, localDevelopment } from './auth';
import {
  audit,
  Conflict,
  InvalidContent,
  getContent,
  getWorkspace,
  getRevision,
  saveContent,
  saveChanges,
} from './repository';
import { ChangeRequestSchema } from '@lzzhu/content/resources';
import { syncMedium, refreshMediumIfNeeded, publicMediumEntries } from './medium';
import {
  activateRelease,
  claimRelease,
  failRelease,
  readSnapshot,
  reconcileRelease,
  releaseById,
  startRelease,
} from './releases';
import { sha256, type AppEnv, type Env } from './types';
import { rewards } from './rewards';
import { firebaseCard } from './firebase/routes';
import { assets } from './assets';
import { health } from './health';
import { artifactKey, storeReleaseArtifact } from './release-artifacts';
import { imageOrigin, previewImageOrigins, studioPolicy } from './image-policy';

const app = new Hono<AppEnv>();
app.use('*', async (c, next) => {
  await next();
  // Apply after the asset response so its default public cache headers cannot win.
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
  if (c.req.path.startsWith('/admin')) {
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Content-Security-Policy', studioPolicy(c.get('imageOrigins'), c.get('isolatedImage')));
  }
});
app.use('/admin', authenticate);
app.use('/admin/*', authenticate);
app.use('/admin/api/*', async (c, next) =>
  bodyLimit({
    maxSize: c.req.path.endsWith('/artifact') ? 64 * 1024 * 1024 : 10 * 1024 * 1024,
    onError: (ctx) => ctx.json({ error: 'Request is too large' }, 413),
  })(c, next),
);
app.use('/api/*', bodyLimit({ maxSize: 4096 }));
app.route('/', rewards);
app.route('/', firebaseCard);
app.get('/api/medium', async (c) => {
  const state = await c.env.DB.prepare('SELECT active_id FROM site_state WHERE id=1').first<{
    active_id: string | null;
  }>();
  let controls: Content['medium'];
  if (state?.active_id) {
    const published = await readSnapshot(c.env, state.active_id);
    const object = await c.env.PRIVATE.get('releases/' + state.active_id + '/medium-controls.json');
    controls = object ? JSON.parse(await object.text()) : published.medium;
  } else if (localDevelopment(c.env, new URL(c.req.url))) {
    const response = await c.env.ASSETS.fetch(new Request(new URL('/assets/medium-public.json', c.req.url)));
    if (!response.ok) return c.json({ error: 'Published feed is not available' }, 503);
    controls = (await response.json()) as Content['medium'];
  } else return c.json({ error: 'No active publication' }, 503);
  const feed = await refreshMediumIfNeeded(c.env);
  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  return c.json({ entries: publicMediumEntries(controls, feed.entries), checkedAt: feed.checkedAt });
});
app.onError((error, c) => {
  if (error instanceof z.ZodError)
    return c.json({ error: 'Content validation failed', issues: error.issues }, 400);
  if (error instanceof Conflict) return c.json({ error: error.message }, 409);
  if (error instanceof InvalidContent) return c.json({ error: error.message }, 400);
  const requestId = crypto.randomUUID();
  console.error('Request failed', requestId, c.req.path, error.message);
  return c.json({ error: 'The request could not be completed. Please try again.', requestId }, 500);
});
app.get('/admin/api/session', async (c) =>
  c.json({ identity: c.get('identity'), csrf: await csrfToken(c.env, c.get('identity')) }),
);
app.get('/admin/api/content', async (c) => {
  const content = await getWorkspace(c.env);
  return content ? c.json(content) : c.json({ error: 'Database needs initial content' }, 503);
});
app.patch('/admin/api/content', async (c) =>
  c.json(await saveChanges(c.env, ChangeRequestSchema.parse(await c.req.json()), c.get('identity').id)),
);
app.put('/admin/api/content', async (c) => {
  const { content, expectedRevision } = z
    .object({ content: ContentSchema, expectedRevision: z.number().int().nonnegative() })
    .parse(await c.req.json());
  return c.json(await saveContent(c.env, content, expectedRevision, c.get('identity').id));
});
app.get('/admin/api/revisions', async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        'SELECT revision,created_at,created_by FROM revisions ORDER BY revision DESC LIMIT 100',
      ).all()
    ).results,
  ),
);
app.get('/admin/api/revisions/:revision', async (c) => {
  const revision = Number(c.req.param('revision'));
  if (!Number.isSafeInteger(revision)) return c.json({ error: 'Invalid revision' }, 400);
  const content = await getRevision(c.env, revision);
  return content ? c.json(content) : c.json({ error: 'Revision not found' }, 404);
});
app.get('/admin/api/feed', async (c) =>
  c.json(await c.env.DB.prepare('SELECT * FROM feed_state WHERE id=1').first()),
);
app.post('/admin/api/feed/sync', async (c) => {
  await syncMedium(c.env);
  return c.json(await c.env.DB.prepare('SELECT * FROM feed_state WHERE id=1').first());
});
app.route('/admin/api/assets', assets);
app.route('/admin/api/health', health);
// External image thumbnails get an isolated document with one explicit image origin.
// The browser loads the image; the Worker never fetches an arbitrary remote URL.
app.get('/admin/image-preview', (c) => {
  const src = c.req.query('src') || '';
  const origin = src.length <= 2048 ? imageOrigin(src) : undefined;
  if (!origin) return c.json({ error: 'Choose a valid HTTPS image address' }, 400);
  c.set('imageOrigins', [origin]);
  c.set('isolatedImage', true);
  return c.html(
    '<!doctype html>' +
      renderToStaticMarkup(
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <title>Image preview</title>
            <style>
              {
                'html,body{margin:0;width:100%;height:100%;overflow:hidden}img{width:100%;height:100%;object-fit:contain}'
              }
            </style>
          </head>
          <body>
            <img src={src} alt={c.req.query('alt')?.slice(0, 1000) || ''} referrerPolicy="no-referrer" />
          </body>
        </html>,
      ),
  );
});
app.get('/admin/preview/:id', async (c) => {
  const content = await getContent(c.env);
  const page = content?.pages.find((p) => p.id === c.req.param('id'));
  if (!content || !page) return c.notFound();
  c.set('imageOrigins', previewImageOrigins(content));
  const html = renderToStaticMarkup(
    <html lang={page.language} data-preview="true">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{page.title}</title>
        <link rel="stylesheet" href="/admin/site.css" />
        <link rel="stylesheet" href="/admin/assets/fonts.css" />
        <style>
          {
            '@view-transition { navigation: none; } @font-face{font-family:lanting;font-weight:300;font-display:swap;src:url("/admin/fonts/lanting.woff2") format("woff2")}'
          }
        </style>
        <script src="/admin/assets/preferences.js" />
      </head>
      <body>
        <SiteShell content={content} page={page} preview />
        <script type="module" src="/admin/runtime.js" />
      </body>
    </html>,
  );
  return c.html('<!doctype html>' + html);
});
app.get('/admin/api/releases', async (c) =>
  c.json({
    releases: (await c.env.DB.prepare('SELECT * FROM releases ORDER BY sequence DESC LIMIT 100').all())
      .results,
    state: await c.env.DB.prepare('SELECT * FROM site_state WHERE id=1').first(),
  }),
);
app.post('/admin/api/releases', async (c) => {
  const { expectedRevision } = z
    .object({ expectedRevision: z.number().int().nonnegative() })
    .parse(await c.req.json());
  const content = await getContent(c.env);
  if (!content || content.revision !== expectedRevision)
    throw new Conflict('Save and review the latest content before publishing');
  return c.json(await startRelease(c.env, content, c.get('identity').id), 201);
});
app.post('/admin/api/releases/:id/rollback', async (c) => {
  const previous = await releaseById(c.env, c.req.param('id'));
  if (!previous || !previous.artifact_hash || !['active', 'superseded'].includes(previous.status))
    return c.json({ error: 'No verified build is available to roll back to' }, 400);
  return c.json(
    await startRelease(c.env, await readSnapshot(c.env, previous.id), c.get('identity').id, {
      rollbackOf: previous.id,
    }),
    201,
  );
});
app.post('/admin/api/releases/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE releases SET status='cancelled',error='Cancelled before a build claimed this release' WHERE id=? AND status IN ('preparing','ready')",
    ).bind(id),
    c.env.DB.prepare(
      "UPDATE site_state SET publishing_id=NULL WHERE id=1 AND publishing_id=? AND EXISTS(SELECT 1 FROM releases WHERE id=? AND status='cancelled')",
    ).bind(id, id),
  ]);
  return result[0].meta.changes
    ? c.json({ ok: true })
    : c.json({ error: 'Build already started; refresh release status' }, 409);
});
app.post('/admin/api/releases/reconcile', async (c) => {
  await reconcileRelease(c.env);
  return c.json({ ok: true });
});
app.get('/admin/api/releases/:id/snapshot', async (c) => {
  const release = await releaseById(c.env, c.req.param('id'));
  if (!release) return c.notFound();
  const object = await c.env.PRIVATE.get('releases/' + release.id + '/snapshot.json');
  const manifest = await c.env.PRIVATE.get('releases/' + release.id + '/manifest.json');
  if (!object || !manifest) return c.json({ error: 'Snapshot is not ready' }, 409);
  return c.json({ release, manifest: JSON.parse(await manifest.text()), snapshot: await object.text() });
});
app.post('/admin/api/releases/:id/claim', async (c) => {
  const { runId } = z.object({ runId: z.string() }).parse(await c.req.json());
  await claimRelease(c.env, c.req.param('id'), runId);
  return c.json({ ok: true });
});
app.post('/admin/api/releases/:id/deploy', async (c) => {
  const { runId } = z.object({ runId: z.string() }).parse(await c.req.json());
  const result = await c.env.DB.prepare(
    "UPDATE releases SET status='deploying' WHERE id=? AND run_id=? AND status='building' AND artifact_hash IS NOT NULL AND EXISTS(SELECT 1 FROM site_state WHERE id=1 AND publishing_id=releases.id AND active_id IS releases.base_id)",
  )
    .bind(c.req.param('id'), runId)
    .run();
  return result.meta.changes
    ? c.json({ ok: true })
    : c.json({ error: 'Release is not eligible to deploy' }, 409);
});
app.get('/admin/api/releases/:id/assets/:asset', async (c) => {
  const asset = c.req.param('asset');
  if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(asset)) return c.notFound();
  const content = await readSnapshot(c.env, c.req.param('id'));
  if (!JSON.stringify(content).includes('/assets/uploads/' + asset))
    return c.json({ error: 'Asset is not in this release' }, 403);
  const object = await c.env.PRIVATE.get('assets/' + asset);
  return object
    ? new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      })
    : c.notFound();
});
app.put('/admin/api/releases/:id/artifact', async (c) => {
  const release = await releaseById(c.env, c.req.param('id'));
  if (!release || release.status !== 'building' || release.run_id !== c.req.header('X-Run-Id'))
    return c.json({ error: 'Build is not current' }, 409);
  const artifact = await c.req.arrayBuffer();
  const hash = await sha256(artifact);
  if (hash !== c.req.header('X-Artifact-SHA256')) return c.json({ error: 'Artifact checksum mismatch' }, 400);
  await storeReleaseArtifact(c.env, release, artifact, hash);
  return c.json({ sha256: hash });
});
app.get('/admin/api/releases/:id/artifact', async (c) => {
  const manifest = await c.env.PRIVATE.get('releases/' + c.req.param('id') + '/manifest.json');
  if (!manifest) return c.notFound();
  const metadata = JSON.parse(await manifest.text()) as { rollbackOf?: string };
  const id = metadata.rollbackOf || c.req.param('id');
  const release = await releaseById(c.env, id);
  const artifact = release?.artifact_hash
    ? await c.env.PRIVATE.get(artifactKey(id, release.artifact_hash))
    : null;
  return artifact && release?.artifact_hash
    ? new Response(artifact.body, {
        headers: {
          'Content-Type': 'application/gzip',
          'X-Artifact-SHA256': release.artifact_hash,
          'Cache-Control': 'no-store',
        },
      })
    : c.notFound();
});
app.post('/admin/api/releases/:id/report', async (c) => {
  const report = z
    .object({
      runId: z.string(),
      stage: z.enum(['deployed', 'failed']),
      error: z.string().max(1000).optional(),
    })
    .parse(await c.req.json());
  const release = await releaseById(c.env, c.req.param('id'));
  if (!release || release.run_id !== report.runId) return c.json({ error: 'Build identity mismatch' }, 409);
  if (report.stage === 'failed') {
    if (release.status === 'building') await failRelease(c.env, release.id, report.error || 'Build failed');
    else if (release.status === 'deploying' && !(await activateRelease(c.env, release.id)))
      await c.env.DB.prepare('UPDATE releases SET error=? WHERE id=?')
        .bind(
          'Deployment outcome needs reconciliation; publication is locked to prevent an older build replacing newer content',
          release.id,
        )
        .run();
    return c.json({ ok: true });
  }
  if (!release.artifact_hash) return c.json({ error: 'Verified rollback artifact is missing' }, 409);
  await c.env.DB.prepare("UPDATE releases SET status='deployed' WHERE id=? AND status='deploying'")
    .bind(release.id)
    .run();
  return c.json({ active: await activateRelease(c.env, release.id) });
});
app.get('/admin/api/audit', async (c) =>
  c.json((await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all()).results),
);
app.get('/admin', (c) => c.redirect('/admin/', 308));
app.get('/admin/*', async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/admin/api/') || url.pathname.startsWith('/admin/preview/'))
    return c.notFound();
  url.pathname = url.pathname.replace(/^\/admin/, '') || '/';
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
});
// Public build assets are served here only by the local development host.
app.get('/assets/*', (c) =>
  localDevelopment(c.env, new URL(c.req.url)) ? c.env.ASSETS.fetch(c.req.raw) : c.notFound(),
);
app.notFound((c) => c.json({ error: 'Not found' }, 404));
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await reconcileRelease(env);
        const entries = await syncMedium(env);
        const state = await env.DB.prepare(
          'SELECT active_id,publishing_id FROM site_state WHERE id=1',
        ).first<{ active_id: string | null; publishing_id: string | null }>();
        if (!state?.active_id || state.publishing_id) return;
        const published = await readSnapshot(env, state.active_id);
        const controls = await env.PRIVATE.get('releases/' + state.active_id + '/medium-controls.json');
        const next = mergeMedium(controls ? JSON.parse(await controls.text()) : published.medium, entries);
        if (JSON.stringify(next.filter((entry) => !entry.hidden)) === JSON.stringify(published.medium))
          return;
        await startRelease(env, { ...published, medium: next }, 'medium-sync', {
          expectedBase: state.active_id,
        });
      })().catch((error) => console.error('Scheduled task failed:', error.message)),
    );
  },
};
export { app };
