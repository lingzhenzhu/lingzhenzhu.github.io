import { z } from 'zod';

export function safeUrl(value: string, image = false): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return !/[\\\u0000-\u001f]/.test(value);
  if (!image && value.startsWith('#')) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || (!image && url.protocol === 'mailto:')) && !url.username && !url.password
    );
  } catch {
    return false;
  }
}
export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
}
const richTypes = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'image',
  'taskList',
  'taskItem',
]);
export function validRichText(value: unknown, depth = 0, count = { value: 0 }): value is RichNode {
  if (!value || typeof value !== 'object' || depth > 24 || ++count.value > 20000) return false;
  const node = value as RichNode;
  if (!richTypes.has(node.type) || (node.text !== undefined && typeof node.text !== 'string')) return false;
  if (node.attrs && (typeof node.attrs !== 'object' || Array.isArray(node.attrs))) return false;
  if (
    (node.type === 'paragraph' || node.type === 'heading') &&
    node.attrs?.textAlign != null &&
    !['left', 'center', 'right', 'justify'].includes(String(node.attrs.textAlign))
  )
    return false;
  if (node.type === 'taskItem' && typeof node.attrs?.checked !== 'boolean') return false;
  if (node.type === 'image' && (typeof node.attrs?.src !== 'string' || !safeUrl(node.attrs.src, true)))
    return false;
  if (
    node.marks !== undefined &&
    (!Array.isArray(node.marks) ||
      !node.marks.every(
        (mark) =>
          !!mark &&
          typeof mark === 'object' &&
          ['bold', 'italic', 'strike', 'code', 'link', 'underline'].includes(mark.type) &&
          (mark.type !== 'link' || (typeof mark.attrs?.href === 'string' && safeUrl(mark.attrs.href))),
      ))
  )
    return false;
  return (
    node.content === undefined ||
    (Array.isArray(node.content) && node.content.every((child) => validRichText(child, depth + 1, count)))
  );
}
export const richText = z.custom<RichNode>(
  (value) => validRichText(value) && value.type === 'doc',
  'Invalid rich text document',
);
export function emptyDocument(): RichNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
