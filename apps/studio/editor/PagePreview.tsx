import { Select } from './Select';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import type { RunTask } from './types';
import './preview.css';

/** Preview owns only its viewport. Draft persistence remains in the workspace queue. */
export function PagePreview({
  pageId,
  version,
  selection,
  save,
  run,
  onSelectBlock,
}: {
  pageId: string;
  version: number;
  selection: { tab: string; blockId: string };
  save: () => Promise<void>;
  run: RunTask;
  onSelectBlock: (id: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1440),
    [surfaceWidth, setSurfaceWidth] = useState(600),
    [refresh, setRefresh] = useState(0);
  const scale = Math.min(1, surfaceWidth / width),
    height = width === 1440 ? 900 : width === 768 ? 1024 : 844;
  const scroll = useRef(0),
    loaded = useRef(false),
    events = useRef<AbortController | undefined>(undefined);
  const callback = useRef(onSelectBlock);
  callback.current = onSelectBlock;
  const previewWindow = () => {
    try {
      return frame.current?.contentDocument?.documentElement.dataset.preview === 'true'
        ? frame.current.contentWindow
        : null;
    } catch {
      return null;
    }
  };
  const reveal = () => {
    const view = previewWindow();
    if (!view) return;
    if (selection.tab === 'opening') {
      view.scrollTo(0, 0);
      return;
    }
    const selector =
      selection.tab === 'news'
        ? '[data-news]'
        : selection.tab === 'medium'
          ? '[data-medium]'
          : selection.blockId && selection.tab === 'content'
            ? '[data-block-id="' + CSS.escape(selection.blockId) + '"] > *'
            : '';
    const target = selector && view.document.querySelector(selector);
    if (target) view.scrollTo(0, target.getBoundingClientRect().top + view.scrollY - 20);
  };
  useEffect(reveal, [selection.tab, selection.blockId]);
  // Later versions replace the preview's own location. Changing the iframe's src instead adds a
  // session history entry per save, so the browser's Back button would step through old previews.
  const src = '/admin/preview/' + pageId + '?v=' + version + '&r=' + refresh;
  const [initialSrc] = useState(src);
  // An off-screen preview (below the editor on phones) skips the full page load each autosave
  // would cost and catches up with the latest version once it scrolls near the viewport.
  const [nearViewport, setNearViewport] = useState(true);
  const shown = useRef(initialSrc);
  useEffect(() => {
    if (!nearViewport || src === shown.current) return;
    const view = frame.current?.contentWindow;
    if (!view) return;
    shown.current = src;
    view.location.replace(src);
  }, [src, nearViewport]);
  useEffect(() => {
    const observer = new ResizeObserver(() => setSurfaceWidth(surface.current!.clientWidth));
    observer.observe(surface.current!);
    const visibility = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      rootMargin: '300px 0px',
    });
    visibility.observe(surface.current!);
    const listener = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === 'site:block-select' &&
        typeof event.data.blockId === 'string'
      )
        callback.current(event.data.blockId);
    };
    window.addEventListener('message', listener);
    return () => {
      observer.disconnect();
      visibility.disconnect();
      events.current?.abort();
      window.removeEventListener('message', listener);
    };
  }, []);
  return (
    <section className="preview-panel" aria-label="Page preview">
      <div className="preview-toolbar">
        <strong>Live preview</strong>
        <Select
          aria-label="Preview size"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
        >
          <option value="1440">Desktop</option>
          <option value="768">Tablet</option>
          <option value="390">Phone</option>
        </Select>
        <Button
          variant="quiet"
          compactIcons="keep"
          icon="refresh"
          className="icon-button"
          aria-label="Update preview"
          onClick={() =>
            run(async () => {
              await save();
              setRefresh((value) => value + 1);
            })
          }
        />
      </div>
      <div className="preview-surface" ref={surface} style={{ height: height * scale + 2 }}>
        <iframe
          ref={frame}
          title="Page preview"
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            marginLeft: Math.max(0, (surfaceWidth - width * scale) / 2),
          }}
          src={initialSrc}
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            const view = previewWindow();
            if (!view) return;
            events.current?.abort();
            events.current = new AbortController();
            view.scrollTo(0, scroll.current);
            if (!loaded.current) reveal();
            loaded.current = true;
            view.addEventListener(
              'scroll',
              () => {
                scroll.current = view.scrollY;
              },
              { signal: events.current.signal, passive: true },
            );
          }}
        />
      </div>
    </section>
  );
}
