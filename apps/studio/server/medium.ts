import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { MediumSchema, mergeMedium, type MediumEntry } from '@lzzhu/content';
import type { Env } from './types';
const FEED = 'https://medium.com/feed/@lzzhu718';
export const FEED_TTL = 5 * 60 * 1000;
export function publicMediumEntries(controls: MediumEntry[], incoming: MediumEntry[]) {
  return mergeMedium(controls, incoming)
    .filter((entry) => !entry.hidden)
    .map((entry) => MediumSchema.parse(entry));
}
/** Atomically claim the next refresh so concurrent visitors share a single RSS request. */
export async function refreshMediumIfNeeded(env: Env) {
  const now = new Date();
  const claim = await env.DB.prepare(
    'UPDATE feed_state SET checked_at=? WHERE id=1 AND (checked_at IS NULL OR checked_at < ?)',
  )
    .bind(now.toISOString(), new Date(now.getTime() - FEED_TTL).toISOString())
    .run();
  if (claim.meta.changes) {
    try {
      await syncMedium(env);
    } catch {
      /* The last successful feed remains available. */
    }
  }
  const state = await env.DB.prepare('SELECT entries,succeeded_at FROM feed_state WHERE id=1').first<{
    entries: string;
    succeeded_at: string | null;
  }>();
  return {
    entries: (JSON.parse(state?.entries || '[]') as unknown[]).map((entry) => MediumSchema.parse(entry)),
    checkedAt: state?.succeeded_at || null,
  };
}
export function parseMedium(xml: string): MediumEntry[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error('Invalid RSS document');
  const data = new XMLParser({ ignoreAttributes: false, processEntities: true, htmlEntities: false }).parse(
    xml,
  );
  const raw = data?.rss?.channel?.item;
  if (!raw) return [];
  const entries = Array.isArray(raw) ? raw : [raw];
  return entries.slice(0, 100).map((item: Record<string, unknown>) => {
    const url = new URL(String(item.link));
    url.search = '';
    url.hash = '';
    const html = String(item['content:encoded'] || item.description || '');
    let cover: string | undefined;
    for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
      const attrs = match[1];
      const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&');
      if (!src || /\b(?:width|height)=["']?1(?:["'\s>]|$)/i.test(attrs)) continue;
      try {
        const image = new URL(src);
        if (
          image.protocol === 'https:' &&
          ['miro.medium.com', 'cdn-images-1.medium.com'].includes(image.hostname) &&
          !image.pathname.includes('/stat')
        ) {
          cover = image.href;
          break;
        }
      } catch {
        /* Ignore malformed or untrusted image locations. */
      }
    }
    const date = new Date(String(item.pubDate));
    const slug = url.pathname.split('/').pop()!;
    return MediumSchema.parse({
      id: slug.match(/[a-f0-9]{12}$/)?.[0] || slug,
      title: String(item.title),
      publishedAt: date.toISOString(),
      url: url.href,
      ...(cover ? { cover } : {}),
      hidden: false,
    });
  });
}
export async function syncMedium(env: Env) {
  const now = new Date().toISOString();
  try {
    const response = await fetch(FEED, {
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/rss+xml,application/xml' },
    });
    if (!response.ok) throw new Error('Medium returned HTTP ' + response.status);
    if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw new Error('Feed too large');
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error('Feed too large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const incoming = parseMedium(new TextDecoder().decode(bytes));
    const previous = await env.DB.prepare('SELECT entries FROM feed_state WHERE id=1').first<{
      entries: string;
    }>();
    const merged = new Map<string, MediumEntry>(
      (JSON.parse(previous?.entries || '[]') as MediumEntry[]).map((entry) => [entry.id, entry]),
    );
    for (const entry of incoming) merged.set(entry.id, entry);
    const entries = [...merged.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    await env.DB.prepare('UPDATE feed_state SET checked_at=?,succeeded_at=?,error=NULL,entries=? WHERE id=1')
      .bind(now, now, JSON.stringify(entries))
      .run();
    return entries;
  } catch (error) {
    await env.DB.prepare('UPDATE feed_state SET checked_at=?,error=? WHERE id=1')
      .bind(now, String(error).slice(0, 500))
      .run();
    throw error;
  }
}
