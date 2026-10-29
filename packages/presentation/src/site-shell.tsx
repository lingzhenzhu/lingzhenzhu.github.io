import { PUBLIC_ORIGIN, type Content, type Page } from '@lzzhu/content';
import { Header } from './header';
import { Accessibility } from './accessibility';
import { RenderBlock } from './blocks';
import { displayDate } from './date';
import { AssetPreviewContext } from './asset-context';
import { PageTitle } from './page-title';
export function SiteShell({
  content,
  page,
  preview = false,
}: {
  content: Content;
  page: Page;
  preview?: boolean;
}) {
  const posts = content.pages
    .filter((p) => p.template === 'article' && p.status === 'published')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const position = posts.findIndex((p) => p.id === page.id);
  const previous = posts[position - 1];
  const next = posts[position + 1];
  const archive = content.pages.find(
    (item) =>
      item.status === 'published' &&
      item.blocks.some((block) => block.type === 'archive' && !block.year && !block.month),
  );
  // Compact pages can expose an opening image immediately. Home content follows a full-height hero.
  const leadingImage =
    page.template === 'home'
      ? undefined
      : page.blocks
          .slice(0, 2)
          .find(
            (block) =>
              block.type === 'image' ||
              (block.type === 'gallery' && block.photos.length > 0) ||
              (block.type === 'research' && block.parts.some((part) => part.type === 'image')),
          )?.id;
  return (
    <AssetPreviewContext value={preview}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="wrapper">
        <Header content={content} page={page} />
        <main className="main" id="main-content">
          <div className="container">
            <article className="post-wrap page">
              <PageTitle page={page} />
              {page.template === 'article' && (
                <div className="post-meta">
                  Author: <a href="/">{content.settings.author}</a>{' '}
                  <span>
                    Date:{' '}
                    <time dateTime={page.date}>
                      {page.date && displayDate(page.date)}
                      {page.articleDetails?.time && <> · {page.articleDetails.time}</>}
                    </time>
                  </span>
                </div>
              )}
              <section
                id="page-content"
                className={'post-content' + (page.template === 'home' ? ' home-content' : '')}
              >
                {page.blocks
                  .filter(
                    (block) =>
                      !(
                        page.template === 'home' &&
                        page.showTitle &&
                        page.homeHero?.image?.source === 'profile' &&
                        block.type === 'profile'
                      ),
                  )
                  .map((block) => (
                    <div className="block-boundary" data-block-id={block.id} key={block.id}>
                      <RenderBlock
                        block={block}
                        content={content}
                        preview={preview}
                        priorityImage={block.id === leadingImage}
                      />
                    </div>
                  ))}
              </section>
              {page.template === 'article' && (
                <>
                  <section className="post-copyright">
                    <p>Author: {content.settings.author}</p>
                    <p>
                      Permalink: <a href={PUBLIC_ORIGIN + page.path}>{PUBLIC_ORIGIN + page.path}</a>
                    </p>
                    {(page.articleDetails?.copyright || page.articleDetails?.licenseLabel) && (
                      <p>
                        License: {page.articleDetails.copyright}{' '}
                        {page.articleDetails.licenseUrl ? (
                          <a href={page.articleDetails.licenseUrl}>{page.articleDetails.licenseLabel}</a>
                        ) : (
                          page.articleDetails.licenseLabel
                        )}
                      </p>
                    )}
                  </section>
                  <section className="post-tags">
                    <div>Tag(s):</div>
                    <div>
                      <a href={archive?.path || '/'} data-back>
                        back
                      </a>{' '}
                      <span>· </span>
                      <a href="/">home</a>
                    </div>
                  </section>
                  <nav className="post-nav" aria-label="Other articles">
                    {previous && (
                      <a className="prev" rel="prev" href={previous.path}>
                        {previous.title}
                      </a>
                    )}
                    {next && (
                      <a className="next" rel="next" href={next.path}>
                        {next.title}
                      </a>
                    )}
                  </nav>
                </>
              )}
            </article>
          </div>
        </main>
        <footer className="footer">
          <div className="copyright">
            <span>{content.settings.footer}</span>
          </div>
        </footer>
      </div>
      <Accessibility />
    </AssetPreviewContext>
  );
}
