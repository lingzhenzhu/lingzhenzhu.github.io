import type { Content } from '@lzzhu/content';
const labels: Record<string, string> = {
  path: 'Page address',
  title: 'Title',
  description: 'Description',
  language: 'Content language',
  src: 'Image address',
  alt: 'Alternative text',
  date: 'Date',
  nameNote: 'Name note',
  document: 'Text content',
  licenseUrl: 'License address',
  homeHero: 'Opening',
};
export function describeIssue(content: Content, path: PropertyKey[], message: string) {
  const page = path[0] === 'pages' && typeof path[1] === 'number' ? content.pages[path[1]] : undefined;
  const section =
    page?.title ||
    { news: 'News', settings: 'Site settings', medium: 'Medium' }[String(path[0])] ||
    'Website';
  const field = [...path].reverse().find((part) => typeof part === 'string' && labels[part]);
  return `${section}${field ? ' · ' + labels[String(field)] : ''}: ${message}`;
}
