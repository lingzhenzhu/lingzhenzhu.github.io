import type { Block, Content } from '@lzzhu/content';
import { Button } from './Button';
import { Select } from './Select';
import { Switch } from './Switch';

/** Plain and searchable lists are modes of the same module, with one result list. */
export function ArticleListFields({
  block,
  content,
  updateBlock,
  setSection,
}: {
  block: Extract<Block, { type: 'archive' | 'articleSearch' }>;
  content: Content;
  updateBlock: (id: string, patch: Record<string, unknown>) => void;
  setSection: (section: string) => void;
}) {
  const searchable = block.type === 'articleSearch';
  const years = [
    ...new Set([
      ...content.pages.filter((p) => p.template === 'article' && p.date).map((p) => p.date!.slice(0, 4)),
      ...(block.year ? [block.year] : []),
    ]),
  ]
    .sort()
    .reverse();
  return (
    <>
      <Button icon="articles" onClick={() => setSection('articles')}>
        Manage articles
      </Button>
      <label className="check">
        <Switch
          checked={searchable}
          onChange={(event) =>
            updateBlock(block.id, {
              type: event.target.checked ? 'articleSearch' : 'archive',
              title: block.title || '',
              pageSize: block.pageSize || 12,
            })
          }
        />
        Search and filters
      </label>
      <p className="field-help">
        Visitors search and filter this list. Clearing the filters restores all its articles.
      </p>
      <label>
        Year
        <Select
          value={block.year || ''}
          onChange={(event) => updateBlock(block.id, { year: event.target.value || undefined })}
        >
          <option value="">All years</option>
          {years.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </Select>
      </label>
      <label>
        Month
        <Select
          value={block.month || ''}
          onChange={(event) => updateBlock(block.id, { month: event.target.value || undefined })}
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index} value={String(index + 1).padStart(2, '0')}>
              {new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
                new Date(Date.UTC(2024, index, 1)),
              )}
            </option>
          ))}
        </Select>
      </label>
      {searchable && (
        <label>
          Articles per page
          <input
            type="number"
            min="5"
            max="50"
            value={block.pageSize || 12}
            onChange={(event) => updateBlock(block.id, { pageSize: Number(event.target.value) })}
          />
        </label>
      )}
    </>
  );
}
