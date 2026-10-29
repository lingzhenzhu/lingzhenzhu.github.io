import { test, expect } from '@playwright/test';
import { writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('publication activates only the matching deployed marker and rollback activates a new release', async ({
  request,
}) => {
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf };
  const content = await (await request.get('/admin/api/content')).json();
  const create = await request.post('/admin/api/releases', {
    headers,
    data: { expectedRevision: content.revision },
  });
  expect(create.status()).toBe(201);
  const first = await create.json();
  const marker = '.artifacts/e2e-state/publication-marker.json';
  const runId = '987654';
  const artifact = Buffer.from('isolated publication artifact');
  const hash = createHash('sha256').update(artifact).digest('hex');
  const deploy = async (id: string) => {
    expect(
      (await request.post(`/admin/api/releases/${id}/claim`, { headers, data: { runId } })).status(),
    ).toBe(200);
    expect(
      (
        await request.put(`/admin/api/releases/${id}/artifact`, {
          headers: { ...headers, 'X-Run-Id': runId, 'X-Artifact-SHA256': hash },
          data: artifact,
        })
      ).status(),
    ).toBe(200);
    expect(
      (await request.post(`/admin/api/releases/${id}/deploy`, { headers, data: { runId } })).status(),
    ).toBe(200);
  };
  const report = async (id: string) =>
    (
      await request.post(`/admin/api/releases/${id}/report`, { headers, data: { runId, stage: 'deployed' } })
    ).json();
  try {
    await deploy(first.id);
    await writeFile(marker, JSON.stringify({ id: 'stale-release', snapshotHash: first.snapshotHash }));
    expect((await report(first.id)).active).toBe(false);
    expect(
      (
        await request.post('/admin/api/releases', { headers, data: { expectedRevision: content.revision } })
      ).status(),
    ).toBe(409);
    await writeFile(marker, JSON.stringify({ id: first.id, snapshotHash: first.snapshotHash }));
    expect((await report(first.id)).active).toBe(true);
    const rollback = await request.post(`/admin/api/releases/${first.id}/rollback`, { headers, data: {} });
    expect(rollback.status()).toBe(201);
    const next = await rollback.json();
    expect(next.id).not.toBe(first.id);
    expect(next.rollbackOf).toBe(first.id);
    const restored = await request.get(`/admin/api/releases/${next.id}/artifact`);
    expect(await restored.body()).toEqual(artifact);
    await deploy(next.id);
    await writeFile(marker, JSON.stringify({ id: next.id, snapshotHash: next.snapshotHash }));
    expect((await report(next.id)).active).toBe(true);
    const state = await (await request.get('/admin/api/releases')).json();
    expect(state.state).toMatchObject({ active_id: next.id, publishing_id: null });
    expect(state.releases.find((release: { id: string }) => release.id === first.id).status).toBe(
      'superseded',
    );
  } finally {
    await rm(marker, { force: true });
  }
});
