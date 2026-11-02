import { useEffect, useId, useState } from 'react';
import type { Content, Page } from '@lzzhu/content';
import { Button } from './Button';
import { ImagePreview } from './image-preview';
import { isSitePage, pageIcon, pageName, sitePages } from './page-model';
import { GlassOptics } from './material/GlassOptics';
import { AccountMenu } from './AccountMenu';

export function WorkspaceNavigation({
  content,
  section,
  page,
  go,
  openPage,
  identity,
  save,
  collapse,
  close,
  showTitle,
}: {
  content?: Content;
  section: string;
  page?: Page;
  go: (section: string) => void;
  openPage: (id: string) => void;
  identity?: { id: string; local: boolean };
  save: () => Promise<void>;
  collapse: () => void;
  close: () => void;
  showTitle: boolean;
}) {
  const pagesId = useId();
  const [pagesOpen, setPagesOpen] = useState(() => {
    try {
      return localStorage.getItem('website-admin-sidebar-pages') !== 'collapsed';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('website-admin-sidebar-pages', pagesOpen ? 'expanded' : 'collapsed');
    } catch {}
  }, [pagesOpen]);
  return (
    <aside className="sidebar" data-glass="sidebar" aria-label="Workspace navigation">
      <GlassOptics />
      <div className="workspace-identity">
        <ImagePreview
          className="studio-brand"
          src={content?.settings.logo || '/assets/logo.svg'}
          alt="Website logo"
        />
        <div>
          {showTitle && <strong>Website admin</strong>}
          <small>lzzhu.net</small>
        </div>
        <Button
          variant="quiet"
          compactIcons="keep"
          className="desktop-sidebar-toggle icon-button"
          icon="sidebar"
          aria-label="Hide sidebar"
          title="Hide sidebar"
          onClick={collapse}
        />
        <Button
          variant="quiet"
          compactIcons="keep"
          className="mobile-sidebar-close icon-button"
          icon="close"
          aria-label="Close sidebar"
          onClick={close}
        />
      </div>
      <div className="sidebar-scroll">
        <p className="sidebar-label">Website</p>
        <nav aria-label="Website">
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="structure"
            className={section === 'structure' ? 'selected' : ''}
            onClick={() => go('structure')}
          >
            Site structure
          </Button>
          <div className="sidebar-disclosure-row">
            <Button
              variant="quiet"
              compactIcons="keep"
              icon="pages"
              className={
                (section === 'pages' && !page) || (!pagesOpen && !!page && isSitePage(page)) ? 'selected' : ''
              }
              // On the overview itself, the row folds its pages, like a sidebar section.
              onClick={() => (section === 'pages' && !page ? setPagesOpen(!pagesOpen) : go('pages'))}
            >
              Pages
            </Button>
            <Button
              variant="quiet"
              compactIcons="keep"
              className="sidebar-disclosure icon-button"
              icon="chevron"
              aria-label={pagesOpen ? 'Hide page list' : 'Show page list'}
              title={pagesOpen ? 'Hide page list' : 'Show page list'}
              aria-expanded={pagesOpen}
              aria-controls={pagesId}
              onClick={() => setPagesOpen(!pagesOpen)}
            />
          </div>
          <div id={pagesId} className="sidebar-pages" data-open={pagesOpen} inert={!pagesOpen}>
            <div>
              {content &&
                sitePages(content).map((item) => (
                  <Button
                    variant="quiet"
                    compactIcons="keep"
                    key={item.id}
                    icon={pageIcon(item)}
                    className={page?.id === item.id ? 'selected' : ''}
                    onClick={() => openPage(item.id)}
                  >
                    <span>{pageName(item)}</span>
                    {item.status === 'draft' && <small>Draft</small>}
                  </Button>
                ))}
            </div>
          </div>
        </nav>
        <p className="sidebar-label">Library</p>
        <nav aria-label="Content">
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="articles"
            className={section === 'articles' || page?.template === 'article' ? 'selected' : ''}
            onClick={() => go('articles')}
          >
            Articles
          </Button>
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="image"
            className={section === 'assets' ? 'selected' : ''}
            onClick={() => go('assets')}
          >
            Image library
          </Button>
        </nav>
        <p className="sidebar-label">Manage</p>
        <nav aria-label="Settings">
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="history"
            className={section === 'history' ? 'selected' : ''}
            onClick={() => go('history')}
          >
            Version history
          </Button>
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="settings"
            className={section === 'settings' ? 'selected' : ''}
            onClick={() => go('settings')}
          >
            Site settings
          </Button>
        </nav>
      </div>
      <div className="sidebar-foot">
        <AccountMenu name={content?.settings.author || 'Administrator'} identity={identity} save={save} />
      </div>
    </aside>
  );
}
