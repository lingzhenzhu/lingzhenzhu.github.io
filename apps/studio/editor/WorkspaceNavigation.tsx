import type { Content, Page } from '@lzzhu/content';
import { Button } from './Button';
import { ImagePreview } from './image-preview';
import { pageName, sitePages } from './page-model';
import { GlassOptics } from './material/GlassOptics';
import { AccountMenu } from './AccountMenu';

function pageIcon(page: Page) {
  if (page.template === 'home') return 'home';
  return (
    (
      { research: 'research', teaching: 'teaching', media: 'media', archive: 'archive' } as Record<
        string,
        string
      >
    )[page.template] ||
    (page.blocks.some((block) => block.type === 'research')
      ? 'research'
      : page.blocks.some((block) => block.type === 'teaching')
        ? 'teaching'
        : 'pages')
  );
}
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
          <Button
            variant="quiet"
            compactIcons="keep"
            icon="pages"
            className={section === 'pages' && !page ? 'selected' : ''}
            onClick={() => go('pages')}
          >
            Pages
          </Button>
          <div className="sidebar-pages">
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
