import { Button } from './controls';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, send } from './api';
import { useDraft } from './useDraft';
import { useSidebar } from './useSidebar';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import { PageEditorLoading } from './PageWorkspaceHeader';
const PageEditor = lazy(() => import('./PageEditor').then((module) => ({ default: module.PageEditor })));
import { ArticlesPanel } from './ArticlesPanel';
import { PagesOverview, SiteStructure } from './SiteStructure';
import { SettingsPanel } from './SettingsPanel';
import { MediaLibrary } from './MediaLibrary';
import { HistoryPanel } from './HistoryPanel';
import { Rewards } from './Rewards';
import { ConfirmDialog } from './controls';
import { WorkspaceNavigation } from './WorkspaceNavigation';
import { WorkspaceActions } from './WorkspaceActions';
import { ScrollEdge } from './ScrollEdge';
import { Icon } from './icons';
import { WorkspaceHeading } from './ui';
import { useMediaQuery } from './useMediaQuery';
import { useGlassLighting } from './material/useGlassLighting';
import { createPage, pageName, type NewPageTemplate } from './page-model';
import type { ReleaseInfo, Revision, Asset } from './types';
import { rememberImageSizes } from './image-sizes';
import './studio.css';
import './editorial.css';
import './theme.css';
import './material/glass.css';
import './shell.css';

/** Every asset listing also teaches the editor each image's size. */
const listAssets = async () => {
  const list = await api<Asset[]>('/assets');
  rememberImageSizes(list);
  return list;
};

function App() {
  useGlassLighting();
  const draft = useDraft();
  const compact = useMediaQuery('(max-width: 700px)');
  const { content, change, save, load, run, local, message, setMessage, error, revision, previewVersion } =
    draft;
  const [sidebar, setSidebar] = useSidebar();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('website-admin-sidebar') === 'hidden';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('website-admin-sidebar', collapsed ? 'hidden' : 'shown');
    } catch {}
  }, [collapsed]);
  const { section, selected, go, openPage: navigatePage } = useWorkspaceNavigation(() => setSidebar(false));
  const openPage = (id: string) =>
    navigatePage(id, content?.pages.find((page) => page.id === id)?.template === 'article');
  const [publishing, setPublishing] = useState(false);
  const [reloading, setReloading] = useState<HTMLElement | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]),
    [releases, setReleases] = useState<ReleaseInfo[]>([]),
    [revisions, setRevisions] = useState<Revision[]>([]);
  const add = (template: NewPageTemplate = 'page') => {
    if (!content) return;
    const page = createPage(content, template);
    change((c) => ({ ...c, pages: [...c.pages, page] }));
    navigatePage(page.id, template === 'article');
  };
  const refreshHistory = useCallback(async () => {
    const [r, v] = await Promise.all([
      api<{ releases: ReleaseInfo[] }>('/releases'),
      api<Revision[]>('/revisions'),
    ]);
    setReleases(r.releases);
    setRevisions(v);
  }, []);
  useEffect(() => {
    if (section === 'history') run(refreshHistory);
    if (section === 'assets') run(async () => setAssets(await listAssets()));
  }, [section, run, refreshHistory]);
  useEffect(() => {
    if (
      section !== 'history' ||
      !releases.some((r) => ['preparing', 'ready', 'building', 'deploying', 'deployed'].includes(r.status))
    )
      return;
    const timer = setTimeout(() => run(refreshHistory), 5000);
    return () => clearTimeout(timer);
  }, [section, releases, run, refreshHistory]);
  const upload = async (file: File) => {
    const result = await api<Asset & { src: string }>('/assets', {
      method: 'POST',
      body: file,
      headers: { 'X-Filename': encodeURIComponent(file.name), 'Content-Type': file.type },
    });
    rememberImageSizes([result]);
    setAssets(await listAssets());
    return result.src;
  };
  const publish = () =>
    run(async () => {
      setPublishing(true);
      try {
        await save();
        await send('/releases', { expectedRevision: revision.current });
        setMessage(local ? 'Local snapshot created' : 'Publication started');
        await refreshHistory();
      } finally {
        setPublishing(false);
      }
    });
  const page = content?.pages.find((p) => p.id === selected);
  const currentName =
    section === 'history'
      ? 'Publishing'
      : page
        ? pageName(page)
        : {
            pages: 'Pages',
            articles: 'Articles',
            structure: 'Site structure',
            assets: 'Image library',
            settings: 'Site settings',
            rewards: 'Request card',
          }[section] || 'Workspace';
  return (
    <div className={'studio ' + (sidebar ? 'sidebar-open ' : '') + (collapsed ? 'navigation-collapsed' : '')}>
      <ScrollEdge />
      <nav className="navigation-launcher" aria-label="Workspace controls">
        <Button
          compactIcons="keep"
          className="icon-button sidebar-toggle"
          icon="menu"
          aria-label="Toggle sidebar"
          aria-expanded={sidebar}
          onClick={() => setSidebar(!sidebar)}
        />
        {collapsed && (
          <Button
            compactIcons="keep"
            className="icon-button desktop-sidebar-toggle"
            icon="sidebar"
            aria-label="Show sidebar"
            onClick={() => setCollapsed(false)}
          />
        )}
        {compact && !sidebar && <span className="mobile-workspace-name">Website admin</span>}
      </nav>
      <WorkspaceActions
        message={message}
        error={error}
        ready={!!content}
        canUndo={draft.canUndo}
        canRedo={draft.canRedo}
        undo={() => draft.historyAction(true)}
        redo={() => draft.historyAction(false)}
        save={() => run(draft.retrySave)}
        review={() => go('history')}
      />
      {error && (
        <div className="error-banner" role="alert" data-glass="alert">
          <Icon name="alert" />
          <div>
            <strong>Changes need attention</strong>
            <p>{error}</p>
          </div>
          <div className="error-banner-actions">
            <Button compactIcons="keep" onClick={() => run(draft.retrySave)}>
              Try saving again
            </Button>
            <Button compactIcons="keep" onClick={(event) => setReloading(event.currentTarget)}>
              Reload saved draft
            </Button>
          </div>
        </div>
      )}
      {reloading && (
        <ConfirmDialog
          title="Reload saved draft?"
          confirmLabel="Reload draft"
          destructive
          returnFocusTo={reloading}
          onClose={() => setReloading(null)}
          onConfirm={load}
        >
          <p>Unsaved edits in this window will be discarded. Saved content will be loaded from the server.</p>
        </ConfirmDialog>
      )}
      <WorkspaceNavigation
        content={content}
        section={section}
        page={page}
        go={go}
        openPage={openPage}
        identity={draft.identity}
        save={save}
        showTitle={!compact || sidebar}
        collapse={() => setCollapsed(true)}
        close={() => setSidebar(false)}
      />
      {sidebar && (
        <Button
          compactIcons="keep"
          variant="quiet"
          className="sidebar-scrim"
          aria-label="Close sidebar"
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="editor-main" aria-label={currentName} tabIndex={-1}>
        {!content && !error && (
          <div className="empty-state" role="status">
            Loading…
          </div>
        )}
        {content &&
          section === 'pages' &&
          (page ? (
            <Suspense fallback={<PageEditorLoading page={page} go={go} />}>
              <PageEditor
                key={page.id}
                content={content}
                change={change}
                page={page}
                go={go}
                run={run}
                upload={upload}
                save={save}
                previewVersion={previewVersion}
              />
            </Suspense>
          ) : (
            <PagesOverview content={content} openPage={openPage} addPage={add} />
          ))}
        {content && section === 'structure' && (
          <SiteStructure content={content} change={change} openPage={openPage} addPage={() => add()} />
        )}
        {content && section === 'settings' && (
          <SettingsPanel content={content} change={change} upload={upload} />
        )}
        {content && section === 'articles' && (
          <div className="collection wide">
            <ArticlesPanel
              standalone
              content={content}
              change={change}
              openPage={openPage}
              addArticle={() => add('article')}
            />
          </div>
        )}
        {section === 'assets' && <MediaLibrary assets={assets} run={run} upload={upload} />}
        {section === 'rewards' && <Rewards />}
        {content && section === 'history' && (
          <div className="publishing-workspace">
            <section className="collection publish-summary">
              <WorkspaceHeading
                eyebrow="Publication"
                title="Publishing"
                description="Review and publish saved changes."
              />
              <div className="publish-card">
                <div>
                  <h2>{local ? 'Create a local snapshot' : 'Publish website'}</h2>
                  <p>
                    {local
                      ? 'Creates a local copy for review. The live website is unchanged.'
                      : 'Publish saved changes to the website.'}
                  </p>
                  <div className="publish-counts">
                    <span>
                      <strong>
                        {
                          content.pages.filter((p) => p.status === 'published' && p.template !== 'article')
                            .length
                        }
                      </strong>{' '}
                      pages & views
                    </span>
                    <span>
                      <strong>
                        {
                          content.pages.filter((p) => p.status === 'published' && p.template === 'article')
                            .length
                        }
                      </strong>{' '}
                      articles
                    </span>
                    <span>
                      <strong>{content.news.filter((n) => n.published).length}</strong> news updates
                    </span>
                  </div>
                </div>
                <Button
                  busy={publishing}
                  className="primary"
                  disabled={
                    publishing ||
                    releases.some((r) =>
                      ['preparing', 'ready', 'building', 'deploying', 'deployed'].includes(r.status),
                    )
                  }
                  onClick={publish}
                >
                  {publishing ? 'Preparing…' : local ? 'Create snapshot' : 'Publish website'}
                </Button>
              </div>
            </section>
            <HistoryPanel
              local={local}
              releases={releases}
              revisions={revisions}
              run={run}
              refreshHistory={refreshHistory}
              change={change}
              currentRevision={revision.current}
              setMessage={setMessage}
            />
          </div>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
