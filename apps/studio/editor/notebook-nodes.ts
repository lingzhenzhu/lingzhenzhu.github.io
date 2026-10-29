import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import { safeUrl, type RichNode } from '@lzzhu/content';
const escape = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
function inline(node: RichNode): string {
  if (node.type === 'hardBreak') return '<br>';
  let value = node.type === 'text' ? escape(node.text) : node.content?.map(inline).join('') || '';
  for (const mark of node.marks || []) {
    const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code' }[mark.type];
    if (tag) value = `<${tag}>${value}</${tag}>`;
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && safeUrl(mark.attrs.href))
      value = `<a href="${escape(mark.attrs.href)}">${value}</a>`;
  }
  return value;
}
const aligned = (node: RichNode) => ['center', 'right', 'justify'].includes(String(node.attrs?.textAlign));
/** CommonMark uses inline HTML for alignment, which has no native Markdown notation. */
export const NotebookParagraph = Paragraph.extend({
  renderMarkdown(node, helpers) {
    if (aligned(node as RichNode))
      return `<p style="text-align:${node.attrs!.textAlign}">${inline(node as RichNode)}</p>`;
    return node.content?.length ? helpers.renderChildren(node.content) : '<p></p>';
  },
});
export const NotebookHeading = Heading.extend({
  renderMarkdown(node, helpers) {
    const level = Math.max(2, Math.min(6, Number(node.attrs?.level) || 2));
    if (aligned(node as RichNode))
      return `<h${level} style="text-align:${node.attrs!.textAlign}"${node.attrs?.id ? ` id="${escape(node.attrs.id)}"` : ''}>${inline(node as RichNode)}</h${level}>`;
    return `${'#'.repeat(level)} ${helpers.renderChildren(node.content || [])}`;
  },
});
