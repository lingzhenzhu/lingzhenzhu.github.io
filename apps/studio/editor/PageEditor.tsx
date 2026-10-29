import { ConfirmDialog, Button } from './controls';
import { useEffect, useRef, useState } from 'react';
import { moduleCapabilities, moduleDefinitions, type Block, type Page } from '@lzzhu/content';
import type { CollectionProps, RunTask } from './types';
import { BlockFields } from './BlockFields';
import { HomeOpening } from './HomeOpening';
import { PageSettings } from './PageSettings';
import { NewsPanel } from './NewsPanel';
import { MediumPanel } from './MediumPanel';
import { Icon } from './ui';
import { blockNames, blockSummary, pageName } from './page-model';
import { PageWorkspaceHeader } from './PageWorkspaceHeader';
import { SortableList } from './SortableList';
import { TransferSection } from './TransferSection';
import { SectionLibrary } from './SectionLibrary';
import { ResizableWorkspace } from './ResizableWorkspace';
import { reorder } from '../../../packages/content/src/operations';
export function PageEditor({
  content,
  change,
  page,
  go,
  run,
  upload,
  save,
  previewVersion,
}: CollectionProps & {
  page: Page;
  go: (section: string) => void;
  run: RunTask;
  upload: (file: File) => Promise<string>;
  save: () => Promise<void>;
  previewVersion: number;
}) {
  const [tab, setTab] = useState('content'),
    [blockId, setBlockId] = useState(''),
    [preview, setPreview] = useState(true),
    [width, setWidth] = useState(1440),
    [deleting, setDeleting] = useState(false),
    [removeBlock, setRemoveBlock] = useState<string>();
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const previewSurface = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(600);
  const previewScale = Math.min(1, previewWidth / width);
  const previewHeight = width === 1440 ? 900 : width === 768 ? 1024 : 844;
  const previewScroll = useRef(0),
    previewLoaded = useRef(false),
    previewEvents = useRef<AbortController | undefined>(undefined);
  const [refresh, setRefresh] = useState(0);
  const [moving, setMoving] = useState(''),
    [adding, setAdding] = useState(false);
  const moveBlock = (id: string, to: number) =>
    change((c) => ({
      ...c,
      pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks: reorder(p.blocks, id, to) } : p)),
    }));
  useEffect(() => {
    const surface = previewSurface.current;
    if (!surface) return;
    const observer = new ResizeObserver(() => setPreviewWidth(surface.clientWidth));
    observer.observe(surface);
    return () => observer.disconnect();
  }, [preview]);
  // Access can redirect an expired session. Never access a cross-origin login frame.
  const previewWindow = () => {
    try {
      return frame.current?.contentDocument?.documentElement.dataset.preview === 'true'
        ? frame.current.contentWindow
        : null;
    } catch {
      return null;
    }
  };
  const home = page.template === 'home',
    medium = page.blocks.some((b) => b.type === 'medium');
  const update = (patch: Partial<Page>) =>
    change((c) => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }));
  const updateBlock = (id: string, patch: Record<string, unknown>) =>
    change((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id
          ? { ...p, blocks: p.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) }
          : p,
      ),
    }));
  const scrollPreview = () => {
    const view = previewWindow();
    if (!view) return;
    if (tab === 'opening') {
      view.scrollTo(0, 0);
      return;
    }
    const selector =
      tab === 'news'
        ? '[data-news]'
        : tab === 'medium'
          ? '[data-medium]'
          : blockId && tab === 'content'
            ? '[data-block-id="' + CSS.escape(blockId) + '"] > *'
            : '';
    const target = selector ? view.document.querySelector(selector) : null;
    if (target) view.scrollTo(0, target.getBoundingClientRect().top + view.scrollY - 20);
  };
  useEffect(scrollPreview, [tab, blockId]);
  useEffect(() => () => previewEvents.current?.abort(), []);
  const tabs = [
    ['content', 'Content'],
    ...(home
      ? [
          ['opening', 'Opening'],
          ['news', 'News'],
        ]
      : []),
    ...(medium ? [['medium', 'Medium']] : []),
    ['settings', 'Page settings'],
  ];
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === 'site:block-select' &&
        typeof event.data.blockId === 'string'
      ) {
        setTab('content');
        setBlockId(event.data.blockId);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  const route = (section: string) => {
    if (section === 'news' || section === 'medium') setTab(section);
    else go(section);
  };
  return (
    <div className="page-workspace">
      <PageWorkspaceHeader page={page} go={go}>
        <Button aria-pressed={preview} onClick={() => setPreview(!preview)}>
          <Icon name="preview" />
          {preview ? 'Hide preview' : 'Show preview'}
        </Button>
      </PageWorkspaceHeader>
      <nav className="section-tabs" aria-label="Page sections">
        {tabs.map(([id, name]) => (
          <Button
            compactIcons="keep"
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {name}
          </Button>
        ))}
      </nav>
      <ResizableWorkspace enabled={preview}>
        <div className="inspector">
          {tab === 'content' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Page content</h2>
                  <p className="muted">
                    Select a section to edit. Drag its handle to reorder. Changes save automatically.
                  </p>
                </div>
              </div>
              {!home && (
                <label>
                  Title
                  <input
                    value={page.title}
                    onChange={(e) =>
                      update({
                        title: e.target.value,
                        ...(page.navLabel === page.title || page.navLabel === 'New page'
                          ? { navLabel: e.target.value.slice(0, 60) }
                          : {}),
                      })
                    }
                  />
                </label>
              )}
              <SortableList
                items={page.blocks}
                label="Page sections order"
                name={blockSummary}
                onMove={moveBlock}
              >
                {(block, index, handle) => (
                  <section
                    key={block.id}
                    className={'block-editor ' + (blockId === block.id ? 'selected' : '')}
                  >
                    <div className="block-bar">
                      {handle}
                      <Button
                        compactIcons="keep"
                        className="block-select"
                        aria-expanded={blockId === block.id}
                        onClick={() => setBlockId(blockId === block.id ? '' : block.id)}
                      >
                        <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                        <span>
                          <strong>
                            <Icon name={moduleDefinitions[block.type].icon} /> {blockNames[block.type]}
                          </strong>
                          <small>{blockSummary(block)}</small>
                        </span>
                        <Icon name="arrow" />
                      </Button>
                    </div>
                    {blockId === block.id && (
                      <>
                        <BlockFields
                          content={content}
                          block={block}
                          updateBlock={updateBlock}
                          run={run}
                          upload={upload}
                          setSection={route}
                        />
                        <div className="block-actions">
                          <Button
                            aria-label="Move section up"
                            disabled={index === 0}
                            onClick={() => {
                              moveBlock(block.id, index - 1);
                            }}
                          >
                            <Icon name="up" /> Move up
                          </Button>
                          <Button
                            aria-label="Move section down"
                            disabled={index === page.blocks.length - 1}
                            onClick={() => {
                              moveBlock(block.id, index + 1);
                            }}
                          >
                            <Icon name="down" /> Move down
                          </Button>
                          <Button
                            disabled={!moduleCapabilities(block.type).move}
                            onClick={(event) => {
                              dialogTrigger.current = event.currentTarget;
                              setMoving(block.id);
                            }}
                          >
                            <Icon name="move" /> Move to page…
                          </Button>
                          {moduleCapabilities(block.type).remove && (
                            <Button
                              className="danger"
                              onClick={(event) => {
                                dialogTrigger.current = event.currentTarget;
                                setRemoveBlock(block.id);
                              }}
                            >
                              <Icon name="trash" /> Remove section
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}
              </SortableList>
              <Button
                className="add-section-button"
                onClick={(event) => {
                  dialogTrigger.current = event.currentTarget;
                  setAdding(true);
                }}
              >
                <Icon name="add" /> Add section
              </Button>
            </>
          )}
          {tab === 'opening' && (
            <HomeOpening
              content={content}
              change={change}
              page={page}
              update={update}
              run={run}
              upload={upload}
            />
          )}
          {tab === 'news' && <NewsPanel content={content} change={change} />}
          {tab === 'medium' && <MediumPanel content={content} change={change} run={run} />}
          {tab === 'settings' && (
            <PageSettings
              page={page}
              update={update}
              onDelete={(trigger) => {
                dialogTrigger.current = trigger;
                setDeleting(true);
              }}
            />
          )}
        </div>
        {preview && (
          <section className="preview-panel" aria-label="Page preview">
            <div className="preview-toolbar">
              <span>Live preview</span>
              <select
                aria-label="Preview size"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              >
                <option value="1440">Desktop</option>
                <option value="768">Tablet</option>
                <option value="390">Phone</option>
              </select>
              <Button
                compactIcons="keep"
                aria-label="Update preview"
                onClick={() =>
                  run(async () => {
                    await save();
                    setRefresh((v) => v + 1);
                  })
                }
              >
                ↻
              </Button>
            </div>
            <div
              className="preview-surface"
              ref={previewSurface}
              style={{ height: previewHeight * previewScale + 2 }}
            >
              <iframe
                ref={frame}
                title="Page preview"
                style={{
                  width,
                  height: previewHeight,
                  transform: `scale(${previewScale})`,
                  marginLeft: Math.max(0, (previewWidth - width * previewScale) / 2),
                }}
                src={'/admin/preview/' + page.id + '?v=' + previewVersion + '&r=' + refresh}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => {
                  const view = previewWindow();
                  if (!view) return;
                  previewEvents.current?.abort();
                  previewEvents.current = new AbortController();
                  view.scrollTo(0, previewScroll.current);
                  if (!previewLoaded.current) scrollPreview();
                  previewLoaded.current = true;
                  view.addEventListener(
                    'scroll',
                    () => {
                      previewScroll.current = view.scrollY;
                    },
                    { signal: previewEvents.current.signal, passive: true },
                  );
                }}
              />
            </div>
          </section>
        )}
      </ResizableWorkspace>
      {adding && (
        <SectionLibrary
          path={page.path}
          returnFocusTo={dialogTrigger.current}
          onClose={() => setAdding(false)}
          onAdd={(block) => {
            change((current) => ({
              ...current,
              pages: current.pages.map((p) =>
                p.id === page.id ? { ...p, blocks: [...p.blocks, block] } : p,
              ),
            }));
            setBlockId(block.id);
          }}
        />
      )}
      {moving && (
        <TransferSection
          content={content}
          change={change}
          pageId={page.id}
          blockId={moving}
          returnFocusTo={dialogTrigger.current}
          onClose={() => {
            setMoving('');
            setBlockId('');
            setTab('content');
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={'Delete ' + pageName(page) + '?'}
          onClose={() => setDeleting(false)}
          returnFocusTo={dialogTrigger.current}
          destructive
          confirmLabel="Delete page"
          onConfirm={() => {
            change((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== page.id) }));
            go(page.template === 'article' ? 'articles' : 'pages');
          }}
        >
          <p>This removes the page from your draft. You can undo this change before publishing.</p>
        </ConfirmDialog>
      )}
      {removeBlock && (
        <ConfirmDialog
          title="Remove this section?"
          onClose={() => setRemoveBlock(undefined)}
          returnFocusTo={dialogTrigger.current}
          destructive
          confirmLabel="Remove section"
          onConfirm={() => update({ blocks: page.blocks.filter((b) => b.id !== removeBlock) })}
        >
          <p>The section will be removed from this page. You can undo this change.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
