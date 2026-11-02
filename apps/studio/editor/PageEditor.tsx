import { ConfirmDialog, Button } from './controls';
import { useRef, useState } from 'react';
import { moduleCapabilities, moduleDefinitions, type Block, type Page } from '@lzzhu/content';
import type { CollectionProps, RunTask } from './types';
import { BlockFields } from './BlockFields';
import { HomeOpening } from './HomeOpening';
import { PageSettings } from './PageSettings';
import { ArticleNavigationSettings } from './ArticleNavigationSettings';
import { NewsPanel } from './NewsPanel';
import { MediumPanel } from './MediumPanel';
import { HeadingRow, Icon } from './ui';
import { blockNames, blockSummary, pageName } from './page-model';
import { PageWorkspaceHeader } from './PageWorkspaceHeader';
import { SortableList } from './SortableList';
import { TransferSection } from './TransferSection';
import { SectionLibrary } from './SectionLibrary';
import { ResizableWorkspace } from './ResizableWorkspace';
import { SegmentedControl } from './SegmentedControl';
import { PagePreview } from './PagePreview';
import { PageOutline } from './PageOutline';
import { reorder } from '@lzzhu/content/operations';
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
    [deleting, setDeleting] = useState(false),
    [removeBlock, setRemoveBlock] = useState<string>();
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const [moving, setMoving] = useState(''),
    [adding, setAdding] = useState(false);
  const moveBlock = (id: string, to: number) =>
    change((c) => ({
      ...c,
      pages: c.pages.map((p) => (p.id === page.id ? { ...p, blocks: reorder(p.blocks, id, to) } : p)),
    }));
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
      <SegmentedControl
        role="navigation"
        className="section-tabs"
        label="Page sections"
        value={tab}
        onChange={setTab}
        options={tabs.map(([value, label]) => ({
          value,
          label,
          icon: (
            {
              content: 'articles',
              opening: 'home',
              news: 'news',
              medium: 'medium',
              settings: 'settings',
            } as Record<string, string>
          )[value],
        }))}
      />
      <ResizableWorkspace enabled={preview}>
        <div className="inspector">
          <div className={'page-editing-columns' + (!preview && tab === 'content' ? ' with-outline' : '')}>
            <div className="editing-fields">
              {tab === 'content' && (
                <>
                  <HeadingRow
                    title="Page content"
                    description="Select a section to edit, or drag to reorder."
                  />
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
                        data-editor-block={block.id}
                        className={'block-editor ' + (blockId === block.id ? 'selected' : '')}
                      >
                        <div className="block-bar">
                          {handle}
                          <Button
                            variant="quiet"
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
                  upload={upload}
                />
              )}
              {tab === 'settings' && page.template === 'article' && (
                <ArticleNavigationSettings content={content} change={change} />
              )}
              {tab === 'news' && <NewsPanel content={content} change={change} />}
              {tab === 'medium' && <MediumPanel content={content} change={change} run={run} />}
              {tab === 'settings' && (
                <PageSettings
                  author={content.settings.author}
                  page={page}
                  update={update}
                  onDelete={(trigger) => {
                    dialogTrigger.current = trigger;
                    setDeleting(true);
                  }}
                />
              )}
            </div>
            {!preview && tab === 'content' && (
              <PageOutline
                page={page}
                selected={blockId}
                update={update}
                settings={() => setTab('settings')}
                select={(id) => {
                  setBlockId(id);
                  requestAnimationFrame(() => {
                    const section = document.querySelector<HTMLElement>(
                      '[data-editor-block="' + CSS.escape(id) + '"]',
                    );
                    if (section)
                      window.scrollTo({
                        top: section.getBoundingClientRect().top + scrollY - 112,
                        behavior: 'instant',
                      });
                  });
                }}
              />
            )}
          </div>
        </div>
        {preview && (
          <PagePreview
            pageId={page.id}
            version={previewVersion}
            selection={{ tab, blockId }}
            save={save}
            run={run}
            onSelectBlock={(id) => {
              setTab('content');
              setBlockId(id);
            }}
          />
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
          <p>The page will be removed from the draft. You can undo this before publishing.</p>
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
