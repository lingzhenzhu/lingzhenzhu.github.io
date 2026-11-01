import { expect, it } from 'vitest';
import { MarkdownManager } from '@tiptap/markdown';
import { editorExtensions } from '../../apps/studio/editor/editor-extensions';
const manager = new MarkdownManager({ extensions: editorExtensions('technical-test') });
it('preserves code containing Markdown fences and literal HTML', () => {
  const code = '```python\nprint("<script>")\n```';
  const doc = {
    type: 'doc',
    content: [
      { type: 'codeBlock', attrs: { language: 'markdown' }, content: [{ type: 'text', text: code }] },
    ],
  };
  const serialized = manager.serialize(doc);
  expect(serialized).toContain('````markdown');
  expect(manager.parse(serialized).content?.[0].content?.[0].text).toBe(code);
});
it('keeps currency as text and accepts escaped dollar signs inside formulas', () => {
  const doc = manager.parse('It costs $5 or $10. Formula: $\\text{\\$5} + x$.');
  const nodes = doc.content?.[0].content || [];
  expect(nodes.filter((node) => node.type === 'inlineMath')).toHaveLength(1);
  expect(nodes.find((node) => node.type === 'inlineMath')?.attrs?.latex).toBe('\\text{\\$5} + x');
  expect(manager.serialize(doc)).toContain('It costs');
});
const paragraph = (...content: object[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const math = (latex: string) => ({ type: 'inlineMath', attrs: { latex } });
const text = (value: string) => ({ type: 'text', text: value });
it.each([
  ['a formula followed by a digit', paragraph(math('x'), text('2 apples'))],
  ['adjacent formulas', paragraph(math('a'), math('b'))],
  ['a formula followed by a dollar sign', paragraph(math('x'), text('$ total'))],
  ['edge whitespace in a formula', paragraph(text('see '), math(' x '), text(' here'))],
  ['a raw dollar inside a formula', paragraph(math(String.raw`\text{$}x`))],
  ['an ordinary formula', paragraph(text('area '), math(String.raw`\pi r^2`), text('.'))],
])('round-trips %s through Markdown', (_, doc) => {
  const once = manager.serialize(doc);
  const parsed = manager.parse(once);
  expect(parsed).toEqual(manager.parse(manager.serialize(parsed)));
  const formulas = (node: { type?: string; attrs?: { latex?: string }; content?: unknown[] }): string[] =>
    node.type === 'inlineMath'
      ? [node.attrs!.latex!]
      : (node.content || []).flatMap((child) => formulas(child as typeof node));
  expect(formulas(parsed)).toEqual(formulas(doc));
  // Editing Markdown must not depend on one exact spacing to keep formulas.
  expect(formulas(manager.parse(once + ' '))).toEqual(formulas(doc));
});
it('keeps the readable dollar form where it is unambiguous', () => {
  expect(manager.serialize(paragraph(text('area '), math(String.raw`\pi r^2`), text('.')))).toBe(
    String.raw`area $\pi r^2$.`,
  );
  expect(manager.serialize(paragraph(math('x'), text('2')))).toBe(String.raw`\(x\)2`);
});
it('round-trips display formulas containing dollar signs', () => {
  const latex = String.raw`\text{\$5} + \text{$}`;
  const doc = { type: 'doc', content: [{ type: 'blockMath', attrs: { latex } }] };
  expect(manager.parse(manager.serialize(doc)).content?.[0]).toEqual(doc.content[0]);
});
const inline = (doc: object) => manager.parse(manager.serialize(doc)).content?.[0].content;
it('keeps plain-text dollar signs as text, escaping only where they would read as a formula', () => {
  expect(manager.serialize(paragraph(text('Tickets cost $5 or $10.')))).toBe('Tickets cost $5 or $10.');
  for (const value of ['Write $x$ for a formula.', '$a$', 'US$ and $b$ end', '$$x$$', 'Pay $$ later']) {
    const doc = paragraph(text(value));
    expect(inline(doc)).toEqual([text(value)]);
  }
  expect(manager.serialize(paragraph(text('Write $x$ here')))).toBe(String.raw`Write \$x$ here`);
});
it('keeps links and emphasis on formulas without spreading them to the next text', () => {
  const link = { type: 'link', attrs: { href: 'https://example.org/', title: null } };
  const doc = paragraph(
    { ...text('see '), marks: [link] },
    { ...math('x'), marks: [link] },
    text(' and '),
    { ...math('y'), marks: [{ type: 'bold' }] },
    text(' end'),
  );
  expect(manager.serialize(doc)).toBe('[see $x$](https://example.org/) and **$y$** end');
  expect(inline(doc)).toEqual(doc.content[0].content);
});
it('the editor language list matches the shared grammar set without duplicates', async () => {
  const { common } = await import('lowlight');
  const { codeLanguages } = await import('@lzzhu/presentation/code-languages');
  expect(new Set(codeLanguages).size).toBe(codeLanguages.length);
  expect([...codeLanguages].sort()).toEqual(Object.keys(common).sort());
});
