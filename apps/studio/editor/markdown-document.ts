import { validRichText, type RichNode } from '@lzzhu/content';

/** Markdown is an editing view. The validated structured document stays authoritative. */
export function markdownDocument(parsed: unknown, previous: RichNode): RichNode {
  if (!validRichText(parsed) || parsed.type !== 'doc')
    throw new Error('This text contains an unsupported or unsafe link or image. Correct it before saving.');
  const next = structuredClone(parsed);
  const headings: RichNode[] = [],
    fresh: RichNode[] = [];
  const visit = (node: RichNode, list: RichNode[]) => {
    if (node.type === 'heading') list.push(node);
    node.content?.forEach((child) => visit(child, list));
  };
  visit(previous, headings);
  visit(next, fresh);
  const text = (node: RichNode): string => node.text || node.content?.map(text).join('') || '';
  const used = new Set<RichNode>();
  for (const [index, heading] of fresh.entries()) {
    const match =
      headings.find((old) => !used.has(old) && text(old) === text(heading)) ||
      (headings.length === fresh.length && !used.has(headings[index]) ? headings[index] : undefined);
    if (match) {
      used.add(match);
      heading.attrs = { ...heading.attrs, id: match.attrs?.id ?? heading.attrs?.id };
    }
  }
  return next;
}
