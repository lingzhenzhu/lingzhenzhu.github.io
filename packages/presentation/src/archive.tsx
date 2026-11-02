import { articleIndex, type Content, type Block } from '@lzzhu/content';
import { ArchiveItems } from './archive-list';
import { SectionHeading } from './section-heading';
import { filterArticles } from '@lzzhu/content/article-search';
export function Archive({
  block,
  content,
}: {
  block: Extract<Block, { type: 'archive' }>;
  content: Content;
}) {
  const posts = filterArticles(articleIndex(content), {
    q: '',
    tag: '',
    year: block.year || '',
    month: block.month || '',
  });
  return (
    <div className="archive-list">
      {block.title && <SectionHeading>{block.title}</SectionHeading>}
      <ArchiveItems entries={posts} />
    </div>
  );
}
