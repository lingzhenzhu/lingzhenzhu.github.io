import type { Page } from '@lzzhu/content';
import versions from './asset-versions.json';

/** Fixed public URLs carry their build's content version. */
function versioned(base: string, file: string) {
  const version = (versions as Record<string, string>)['/assets/' + file];
  return base + file + (version ? '?v=' + version : '');
}

/** Optional module assets are identical in the public site and authenticated previews. */
export function pageStylesheets(page: Page, preview = false): string[] {
  const base = (preview ? '/admin' : '') + '/assets/';
  const styles: string[] = [];
  if (page.blocks.some((block) => block.type === 'firebaseRewards' && !block.hidden))
    styles.push(versioned(base, 'card-fonts.css'));
  if (
    page.blocks.some(
      (block) => block.type === 'rewards' || (block.type === 'firebaseRewards' && !block.hidden),
    )
  )
    styles.push(versioned(base, 'request-card.css'));
  if (containsMath(page.blocks)) styles.push(versioned(base, 'math/katex.min.css'));
  return styles;
}
function containsMath(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMath);
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  return node.type === 'inlineMath' || node.type === 'blockMath' || Object.values(node).some(containsMath);
}

export function pageScripts(page: Page, preview = false): string[] {
  return page.blocks.some((block) => block.type === 'articleSearch')
    ? [versioned((preview ? '/admin' : '') + '/assets/', 'article-search.js')]
    : [];
}
