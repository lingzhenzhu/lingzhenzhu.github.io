import { describe, it, expect } from 'vitest';
import {
  parseMedium,
  publicMediumEntries,
  refreshMediumIfNeeded,
  syncMedium,
} from '../../apps/studio/server/medium';
import type { Env } from '../../apps/studio/server/types';
import { vi } from 'vitest';
const rss = (body: string) => '<rss version="2.0"><channel>' + body + '</channel></rss>';
const item = (html: string) =>
  '<item><title><![CDATA[Research & writing]]></title><link>https://medium.com/@lzzhu718/article-abc?source=rss</link><pubDate>Fri, 12 Apr 2024 05:50:49 GMT</pubDate><content:encoded><![CDATA[' +
  html +
  ']]></content:encoded></item>';
describe('official Medium feed', () => {
  it('requests RSS using the redirect mode supported by Workers', async () => {
    const query = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue({ entries: '[]' }),
    };
    const env = { DB: { prepare: vi.fn().mockReturnValue(query) } } as unknown as Env;
    const upstream = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(rss(item(''))));
    try {
      expect(await syncMedium(env)).toHaveLength(1);
      expect(upstream).toHaveBeenCalledWith(
        'https://medium.com/feed/@lzzhu718',
        expect.objectContaining({ redirect: 'manual' }),
      );
    } finally {
      upstream.mockRestore();
    }
  });
  it('keeps published visibility and cover decisions while admitting new RSS articles', () => {
    const entry = parseMedium(rss(item('')))[0];
    const controls = [
      { ...entry, hidden: true },
      { ...entry, id: 'cover', coverOverride: '/assets/published.jpg' },
    ];
    const result = publicMediumEntries(controls, [
      entry,
      { ...entry, id: 'cover', cover: 'https://miro.medium.com/new.jpg' },
      { ...entry, id: 'new' },
    ]);
    expect(result.map((e) => e.id)).not.toContain(entry.id);
    expect(result.find((e) => e.id === 'cover')?.coverOverride).toBe('/assets/published.jpg');
    expect(result.find((e) => e.id === 'new')).toBeDefined();
  });
  it('uses the saved feed without another upstream request during the refresh lease', async () => {
    const entries = parseMedium(rss(item('')));
    const query = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
      first: vi
        .fn()
        .mockResolvedValue({ entries: JSON.stringify(entries), succeeded_at: '2026-10-24T00:00:00.000Z' }),
    };
    const env = { DB: { prepare: vi.fn().mockReturnValue(query) } } as unknown as Env;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      expect((await refreshMediumIfNeeded(env)).entries).toEqual(entries);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('extracts a real cover and discards trackers and query parameters', () => {
    const result = parseMedium(
      rss(
        item(
          '<img src="https://medium.com/_/stat?x=1" width="1" height="1"><img src="https://miro.medium.com/test.jpg" width="1200">',
        ),
      ),
    );
    expect(result[0]).toMatchObject({
      title: 'Research & writing',
      url: 'https://medium.com/@lzzhu718/article-abc',
      cover: 'https://miro.medium.com/test.jpg',
      publishedAt: '2024-04-12T05:50:49.000Z',
    });
  });
  it('does not manufacture a cover when there is only a tracking image', () => {
    expect(
      parseMedium(rss(item('<img src="https://medium.com/_/stat" width="1" height="1">')))[0].cover,
    ).toBeUndefined();
  });
  it('rejects external entities and non-Medium story links', () => {
    expect(() => parseMedium('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>')).toThrow();
    expect(() =>
      parseMedium(
        rss(item('').replace('https://medium.com/@lzzhu718/article-abc', 'https://attacker.example/article')),
      ),
    ).toThrow();
  });
});
