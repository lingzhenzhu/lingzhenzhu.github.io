import { type Content, type Page } from '@lzzhu/content';
import { Header } from './header';
import { Accessibility } from './accessibility';
import { RenderBlock } from './blocks';
import { ArticleDates, ArticleCredit, ArticleReturn } from './article-details';
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
  // Home has its own profile-image priority; other pages prioritize their first content image.
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
              {page.template === 'article' && <ArticleDates page={page} />}
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
                  <ArticleCredit page={page} author={content.settings.author} />
                  <ArticleReturn content={content} page={page} />
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
