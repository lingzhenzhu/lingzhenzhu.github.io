import type { ReactNode } from 'react';
import type { Page } from '@lzzhu/content';
import { Button } from './Button';
import { pageName } from './page-model';

type Props = {
  page: Page;
  go: (section: string) => void;
  children?: ReactNode;
};

/** Page identity remains available while the editing tools load. */
export function PageWorkspaceHeader({ page, go, children }: Props) {
  return (
    <header className="page-workspace-header">
      <div>
        <div className="breadcrumbs">
          <Button compactIcons="keep" onClick={() => go(page.template === 'article' ? 'articles' : 'pages')}>
            {page.template === 'article' ? 'Articles' : 'Pages'}
          </Button>
          <span>/</span>
          <span>{pageName(page)}</span>
        </div>
        <h1>
          {pageName(page)}{' '}
          <span className={'badge ' + (page.status === 'published' ? 'live' : '')}>
            {page.status === 'published' ? 'Public' : 'Draft'}
          </span>
        </h1>
      </div>
      {children}
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
