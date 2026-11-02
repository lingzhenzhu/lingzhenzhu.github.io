import type { ReactNode } from 'react';
import type { Page } from '@lzzhu/content';
import { Button } from './Button';
import { Icon } from './icons';
import { pageName } from './page-model';

type Props = {
  page: Page;
  go: (section: string) => void;
  children?: ReactNode;
};

/** Page identity remains available while the editing tools load. The breadcrumb keeps
 * one line and shortens the page name before it reaches the header actions. */
export function PageWorkspaceHeader({ page, go, children }: Props) {
  return (
    <header className="page-workspace-header">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Button
          variant="quiet"
          compactIcons="keep"
          onClick={() => go(page.template === 'article' ? 'articles' : 'pages')}
        >
          {page.template === 'article' ? 'Articles' : 'Pages'}
        </Button>
        <Icon name="arrow" />
        <span title={pageName(page)}>{pageName(page)}</span>
      </nav>
      <h1>
        {pageName(page)}{' '}
        <span className={'badge ' + (page.status === 'published' ? 'live' : '')}>
          {page.status === 'published' ? 'Public' : 'Draft'}
        </span>
      </h1>
      {children && <div className="page-workspace-actions">{children}</div>}
    </header>
  );
}

export function PageEditorLoading(props: Props) {
  return (
    <div className="page-workspace">
      <PageWorkspaceHeader {...props} />
      <p className="empty-state" role="status">
        Opening page editor…
      </p>
    </div>
  );
}
