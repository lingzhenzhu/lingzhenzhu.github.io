import { Button } from './controls';
import { lazy, Suspense, useEffect, useState } from 'react';
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
import { Icon } from './ui';
import { ConfirmDialog, StatusMessage } from './controls';
import { ImagePreview } from './image-preview';
import { createPage, pageName, sitePages } from './page-model';
import type { ReleaseInfo, Revision, Asset } from './types';
import './studio.css';
import './editorial.css';

function App() {
  const draft = useDraft();
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
  const add = (article = false) => {
    if (!content) return;
    const page = createPage(content, article);
    change((c) => ({ ...c, pages: [...c.pages, page] }));
    navigatePage(page.id, article);
  };
  const refreshHistory = async () => {
    const [r, v] = await Promise.all([
      api<{ releases: ReleaseInfo[] }>('/releases'),
      api<Revision[]>('/revisions'),
    ]);
    setReleases(r.releases);
    setRevisions(v);
  };
  useEffect(() => {
    if (section === 'history') run(refreshHistory);
    if (section === 'assets') run(async () => setAssets(await api('/assets')));
  }, [section]);
  useEffect(() => {
    if (
      section !== 'history' ||
      !releases.some((r) => ['preparing', 'ready', 'building', 'deploying', 'deployed'].includes(r.status))
    )
      return;
    const timer = setTimeout(() => run(refreshHistory), 5000);
    return () => clearTimeout(timer);
  }, [section, releases]);
  const upload = async (file: File) => {
    const result = await api<{ src: string }>('/assets', {
      method: 'POST',
      body: file,
      headers: { 'X-Filename': encodeURIComponent(file.name), 'Content-Type': file.type },
    });
    setAssets(await api('/assets'));
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
      <header className="studio-top">
        <div className="workspace-identity">
          <Button
            compactIcons="keep"
            className="icon-button desktop-sidebar-toggle"
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Icon name="menu" />
          </Button>
          <Button
            compactIcons="keep"
            className="icon-button sidebar-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={sidebar}
            onClick={() => setSidebar(!sidebar)}
          >
            <Icon name="menu" />
          </Button>
          <ImagePreview
            className="studio-brand"
            src={content?.settings.logo || '/assets/logo.svg'}
            alt="Website logo"
          />
          <div>
            <strong>Website admin</strong>
          </div>
        </div>
        <div className="top-actions">
          <StatusMessage
            tone={
              error
                ? 'error'
                : message === 'Saving…'
                  ? 'busy'
                  : message === 'All changes saved'
                    ? 'success'
                    : 'neutral'
            }
          >
            {message}
          </StatusMessage>
          <div className="history-actions">
            <Button
              compactIcons="keep"
              className="icon-button"
              aria-label="Undo change"
              disabled={!draft.canUndo}
              onClick={() => draft.historyAction(true)}
            >
              <Icon name="undo" />
            </Button>
            <Button
              compactIcons="keep"
              className="icon-button"
              aria-label="Redo change"
              disabled={!draft.canRedo}
              onClick={() => draft.historyAction(false)}
            >
              <Icon name="redo" />
            </Button>
          </div>
          <Button onClick={() => run(draft.retrySave)} disabled={!content}>
            <Icon name="check" /> Save
          </Button>
          <Button className="primary" onClick={() => go('history')} disabled={!content}>
            <Icon name="publish" />
            <span>Review & publish</span>
          </Button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <strong>Changes need attention</strong>
          <p>{error}</p>
          <Button compactIcons="keep" onClick={() => run(draft.retrySave)}>
            Try saving again
          </Button>
          <Button compactIcons="keep" onClick={(event) => setReloading(event.currentTarget)}>
            Reload saved draft
          </Button>
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
      <aside className="sidebar" aria-label="Workspace navigation">
        <p className="sidebar-label">Website</p>
        <nav aria-label="Website">
          <Button
            compactIcons="keep"
            className={section === 'structure' ? 'selected' : ''}
            onClick={() => go('structure')}
          >
            <Icon name="structure" />
            Site structure
          </Button>
          <Button
            compactIcons="keep"
            className={section === 'pages' && !page ? 'selected' : ''}
            onClick={() => go('pages')}
          >
            <Icon name="pages" />
            Pages
          </Button>
          <div className="sidebar-pages">
            {content &&
              sitePages(content).map((p) => (
                <Button
                  compactIcons="keep"
                  key={p.id}
                  className={page?.id === p.id ? 'selected' : ''}
                  onClick={() => openPage(p.id)}
                >
                  <span className="page-dot" />
                  <span>{pageName(p)}</span>
                  {p.status === 'draft' && <small>Draft</small>}
                </Button>
              ))}
          </div>
        </nav>
        <p className="sidebar-label">Content</p>
        <nav aria-label="Content">
          <Button
            compactIcons="keep"
            className={section === 'articles' || page?.template === 'article' ? 'selected' : ''}
            onClick={() => go('articles')}
          >
            <Icon name="articles" /> Articles
          </Button>
          <Button
            compactIcons="keep"
            className={section === 'assets' ? 'selected' : ''}
            onClick={() => go('assets')}
          >
            <Icon name="image" />
            Image library
          </Button>
        </nav>
        <p className="sidebar-label">Settings</p>
        <nav aria-label="Settings">
          <Button
            compactIcons="keep"
            className={section === 'settings' ? 'selected' : ''}
            onClick={() => go('settings')}
          >
            <Icon name="settings" />
            Site settings
          </Button>
        </nav>
        <div className="sidebar-foot">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Icon name="globe" />
            View website ↗
          </a>
          <p>
            Draft changes stay private
            <br />
            until you publish.
          </p>
        </div>
      </aside>
      {sidebar && (
        <Button
          compactIcons="keep"
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
            <PagesOverview content={content} openPage={openPage} addPage={() => add()} />
          ))}
        {content && section === 'structure' && (
          <SiteStructure content={content} change={change} openPage={openPage} addPage={() => add()} />
        )}
        {content && section === 'settings' && (
          <SettingsPanel content={content} change={change} run={run} upload={upload} />
        )}
        {content && section === 'articles' && (
          <div className="collection wide">
            <ArticlesPanel
              standalone
              content={content}
              change={change}
              openPage={openPage}
              addArticle={() => add(true)}
            />
          </div>
        )}
        {section === 'assets' && <MediaLibrary assets={assets} run={run} upload={upload} />}
        {section === 'rewards' && <Rewards />}
        {content && section === 'history' && (
          <div className="publishing-workspace">
            <section className="collection publish-summary">
              <div className="workspace-heading">
                <div>
                  <p className="eyebrow">Publication</p>
                  <h1>Publishing</h1>
                  <p>Review and publish saved changes.</p>
                </div>
              </div>
              <div className="publish-card">
                <div>
                  <h2>{local ? 'Create a local snapshot' : 'Publish your website'}</h2>
                  <p>
                    {local
                      ? 'Creates a local copy for review. The live website is unchanged.'
                      : 'Your saved pages, news and images are published together.'}
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
