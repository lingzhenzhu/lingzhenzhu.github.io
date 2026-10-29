import { moduleDefinitions, type Content } from '@lzzhu/content';
import { Icon } from './ui';
type Source = NonNullable<(typeof moduleDefinitions)[keyof typeof moduleDefinitions]['sharedSource']>;
export function SharedSourceNotice({
  content,
  source,
  settings = false,
}: {
  content: Content;
  source: Source;
  settings?: boolean;
}) {
  const pages = content.pages.filter((page) =>
    page.blocks.some((block) => moduleDefinitions[block.type].sharedSource === source),
  );
  const names = { news: 'News', medium: 'Medium articles', contacts: 'Contact links', articles: 'Articles' };
  return (
    <aside className="shared-source" aria-label="Shared content">
      <Icon name="link" />
      <div>
        <strong>{names[source]} · shared content</strong>
        <p>
          {pages.length
            ? 'Content changes appear on ' +
              pages
                .slice(0, 3)
                .map((page) => (page.template === 'home' ? 'Home' : page.title))
                .join(', ') +
              (pages.length > 3 ? ` and ${pages.length - 3} other pages.` : '.')
            : 'Not currently displayed on a page.'}
        </p>
        {pages.length > 3 && (
          <details>
            <summary>View all {pages.length} pages</summary>
            <ul>
              {pages.map((page) => (
                <li key={page.id}>{page.template === 'home' ? 'Home' : page.title}</li>
              ))}
            </ul>
          </details>
        )}
        {settings && <small>Heading and display options below apply only to this section.</small>}
      </div>
    </aside>
  );
}
