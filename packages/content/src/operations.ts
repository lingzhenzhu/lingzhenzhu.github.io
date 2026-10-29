import type { Content } from './index';
import { moduleCapabilities, moduleDefinitions } from './module-contracts';

/** Stable identifiers, not captured array positions, are the editing boundary. */
export function reorder<T extends { id: string }>(items: T[], id: string, to: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || !Number.isInteger(to) || to < 0 || to >= items.length || from === to) return items;
  const result = [...items];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

export function moveSection(content: Content, sourceId: string, blockId: string, targetId: string): Content {
  const source = content.pages.find((page) => page.id === sourceId);
  const target = content.pages.find((page) => page.id === targetId);
  const block = source?.blocks.find((item) => item.id === blockId);
  if (!source || !target || !block || source === target)
    throw new Error('Choose a different, existing page.');
  if (target.blocks.length >= 300) throw new Error('The destination page is full.');
  if (target.blocks.some((item) => item.id === block.id))
    throw new Error('This section already exists on the destination page.');
  const allowedPath = moduleDefinitions[block.type].allowedPath;
  if (allowedPath && target.path !== allowedPath)
    throw new Error('This section must stay on its protected page.');
  return {
    ...content,
    pages: content.pages.map((page) =>
      page.id === source.id
        ? { ...page, blocks: page.blocks.filter((item) => item.id !== blockId) }
        : page.id === target.id
          ? { ...page, blocks: [block, ...page.blocks] }
          : page,
    ),
  };
}

/** Copies are independent instances; shared feeds still use the same content collection. */
export function copySection(content: Content, sourceId: string, blockId: string, targets: string[]): Content {
  const block = content.pages
    .find((page) => page.id === sourceId)
    ?.blocks.find((item) => item.id === blockId);
  if (!block || !targets.length) throw new Error('Choose at least one destination.');
  if (moduleDefinitions[block.type].allowedPath)
    throw new Error('This section must stay on its protected page.');
  if (!moduleCapabilities(block.type).copy) throw new Error('This existing section cannot be copied.');
  const ids = new Set(targets);
  if (targets.some((id) => !content.pages.some((page) => page.id === id)))
    throw new Error('A destination page no longer exists.');
  if (content.pages.some((page) => ids.has(page.id) && page.blocks.length >= 300))
    throw new Error('A destination page is full.');
  return {
    ...content,
    pages: content.pages.map((page) => {
      if (!ids.has(page.id)) return page;
      const copy = structuredClone(block);
      const anchors = new Map<string, string>();
      // Repeated heading IDs on a page would break fragment links and accessibility.
      const renew = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        const item = value as Record<string, unknown>;
        if (typeof item.id === 'string') {
          const previous = item.id;
          item.id = crypto.randomUUID();
          anchors.set(previous, item.id as string);
        }
        if (typeof item.headingId === 'string') {
          const next = 'course-' + item.id;
          anchors.set(item.headingId, next);
          item.headingId = next;
        }
        Object.values(item).forEach(renew);
      };
      renew(copy);
      // Links within a copied section must follow its new heading anchors.
      const relink = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        const item = value as Record<string, unknown>;
        if (typeof item.href === 'string' && item.href.startsWith('#')) {
          const replacement = anchors.get(item.href.slice(1));
          if (replacement) item.href = '#' + replacement;
        }
        Object.values(item).forEach(relink);
      };
      relink(copy);
      return { ...page, blocks: [copy, ...page.blocks] };
    }),
  };
}
