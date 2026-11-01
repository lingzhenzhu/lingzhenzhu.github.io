import type { ArticleEntry } from './article';
export type { ArticleEntry };
export interface ArticleQuery {
  q: string;
  tag: string;
  year: string;
  month: string;
}
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
// Each article is normalized once, on the first text query, not once per term and keystroke.
const searchable = new WeakMap<ArticleEntry, string>();
function haystack(entry: ArticleEntry) {
  let text = searchable.get(entry);
  if (text === undefined) {
    text = normalize(entry.title + ' ' + entry.tags.join(' ') + ' ' + entry.text);
    searchable.set(entry, text);
  }
  return text;
}
/** Normalizes the index ahead of time, e.g. while the browser is idle after it loads. */
export function prepareArticleSearch(entries: ArticleEntry[]) {
  for (const entry of entries) haystack(entry);
}
export function filterArticles(entries: ArticleEntry[], query: ArticleQuery) {
  const terms = [...new Set(normalize(query.q.trim()).split(/\s+/).filter(Boolean))];
  return entries
    .filter(
      (entry) =>
        (!query.tag || entry.tags.includes(query.tag)) &&
        (!query.year || entry.date.slice(0, 4) === query.year) &&
        (!query.month || entry.date.slice(5, 7) === query.month) &&
        (!terms.length || terms.every((term) => haystack(entry).includes(term))),
    )
    .sort(
      (a, b) =>
        Number(!a.date) - Number(!b.date) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    );
}
