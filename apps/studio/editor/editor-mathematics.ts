import { InlineMath, BlockMath } from '@tiptap/extension-mathematics';
import { Node, type JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { formulaOptions } from '@lzzhu/presentation/formula';
import type { FormulaDraft } from './FormulaDialog';

/**
 * Formula Markdown protocol. `$…$` is the readable default; `\(…\)` is written only where the
 * dollar form would not parse back (a following digit or formula, edge whitespace, a raw `$`).
 * Both forms are accepted on input, so every formula survives a Markdown round trip. A dollar
 * sign in plain text is written as `\$` only when it would otherwise read as a formula.
 */
const dollarInline = /^\$((?:\\[\s\S]|[^$\\\n])+)\$(?!\$)/;
const parenInline = /^\\\(((?:\\(?!\))[\s\S]|[^\\])+?)\\\)/;
const displayBlock = /^\$\$((?:\\[\s\S]|\$(?!\$)|[^$\\])+)\$\$/;
// Private-use characters pass through Markdown untouched. Formulas and escaped dollars travel as
// placeholders inside ordinary text, so Tiptap writes their links and emphasis like any text.
const OPEN = '',
  CLOSE = '';
const PLACEHOLDER = /(\d+)/g;

function dollarSafe(latex: string, following = '') {
  const match = ('$' + latex + '$').match(dollarInline);
  return (
    !!match && match[0].length === latex.length + 2 && latex === latex.trim() && !/^[\d$]/.test(following)
  );
}
/** Markdown for one formula; `following` is the source text that will come right after it. */
export function formulaMarkdown(latex: string, block: boolean, following = '') {
  if (block) return '$$\n' + latex.trim() + '\n$$';
  return dollarSafe(latex, following) ? '$' + latex + '$' : '\\(' + latex + '\\)';
}
function followingText(node: JSONContent | undefined) {
  if (!node) return '';
  if (node.type === 'inlineMath') return '$';
  return node.type === 'text' ? node.text || '' : '';
}
/** Would Markdown read the `$` at `index` of this plain text as the start of a formula? */
function opensFormula(text: string, index: number) {
  // Both dollars of a leading `$$` are escaped; either one alone still opens a display formula.
  if (index < 2 && displayBlock.test(text)) return true;
  const rest = text.slice(index);
  const match = rest.match(dollarInline);
  return !!match && match[1] === match[1].trim() && !/^\d/.test(rest.slice(match[0].length));
}
/** Inline delimiters depend on the next sibling, which only the parent can see. */
function prepareFormulas(node: JSONContent, put: (markdown: string) => string): JSONContent {
  if (!node.content || node.type === 'codeBlock') return node;
  const content = node.content.map((child) => prepareFormulas(child, put));
  return {
    ...node,
    content: content.map((child, index) => {
      if (child.type === 'inlineMath') {
        const markdown = formulaMarkdown(child.attrs?.latex || '', false, followingText(content[index + 1]));
        return { type: 'text', text: put(markdown), ...(child.marks ? { marks: child.marks } : {}) };
      }
      const text = child.type === 'text' ? child.text || '' : '';
      if (!text.includes('$') || child.marks?.some((mark) => mark.type === 'code')) return child;
      let escaped = '';
      for (let i = 0; i < text.length; i++)
        escaped += text[i] === '$' && opensFormula(text, i) ? put('\\$') : text[i];
      return { ...child, text: escaped };
    }),
  };
}
/** Tiptap's document node, plus the formula pass before its children are written. */
export const FormulaDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
  renderMarkdown(node, helpers) {
    if (!node.content) return '';
    // Text that already contains the placeholder characters is written without the pass.
    if (/[]/.test(JSON.stringify(node.content))) return helpers.renderChildren(node.content, '\n\n');
    const pieces: string[] = [];
    const put = (markdown: string) => OPEN + (pieces.push(markdown) - 1) + CLOSE;
    return helpers
      .renderChildren(prepareFormulas(node, put).content!, '\n\n')
      .replace(PLACEHOLDER, (_, index: string) => pieces[Number(index)]);
  },
});

// Tiptap's Markdown parser gives links and emphasis only to text. A formula inside them keeps the
// mark too, which is exactly what the document pass above writes.
const manager = MarkdownManager.prototype as unknown as {
  applyMarkToContent(type: string, content: JSONContent[], attrs?: Record<string, unknown>): JSONContent[];
};
const applyMarkToText = manager.applyMarkToContent;
manager.applyMarkToContent = function (type, content, attrs) {
  return applyMarkToText.call(this, type, content, attrs).map((node) =>
    node.type === 'inlineMath'
      ? { ...node, marks: [...(node.marks || []), attrs ? { type, attrs } : { type }] }
      : node,
  );
};

const EditorialInlineMath = InlineMath.extend({
  renderMarkdown(node) {
    return formulaMarkdown(node.attrs?.latex || '', false);
  },
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start: (source) => {
      const starts = [source.indexOf('$'), source.indexOf('\\(')].filter((index) => index >= 0);
      return starts.length ? Math.min(...starts) : -1;
    },
    tokenize(source) {
      const paren = source.match(parenInline);
      if (paren) return { type: 'inlineMath', raw: paren[0], latex: paren[1] };
      const match = source.match(dollarInline);
      // Pandoc's rule keeps prices such as "$5–$10" as text.
      if (!match || match[1] !== match[1].trim() || /^\d/.test(source.slice(match[0].length)))
        return undefined;
      return { type: 'inlineMath', raw: match[0], latex: match[1] };
    },
  },
});
const EditorialBlockMath = BlockMath.extend({
  markdownTokenizer: {
    name: 'blockMath',
    level: 'block',
    // A display formula begins a line; a `$$` inside a sentence must not end its paragraph.
    start: (source) => {
      const match = /(?:^|\n)\$\$/.exec(source);
      return match ? match.index + match[0].length - 2 : -1;
    },
    tokenize(source) {
      const match = source.match(displayBlock);
      return match ? { type: 'blockMath', raw: match[0], latex: match[1].trim() } : undefined;
    },
  },
});
export function editorMathematics(edit?: (draft: FormulaDraft) => void) {
  return [EditorialInlineMath, EditorialBlockMath].map((extension) =>
    extension
      .extend({
        addNodeView() {
          const parent = this.parent!();
          return (props) => {
            const view = parent!(props);
            const element = view.dom as HTMLElement;
            element.tabIndex = 0;
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', 'Edit formula: ' + props.node.attrs.latex);
            const open = () => {
              const pos = props.getPos();
              if (pos !== undefined)
                edit?.({ latex: props.node.attrs.latex, block: props.node.type.name === 'blockMath', pos });
            };
            const key = (event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
              }
            };
            element.addEventListener('keydown', key);
            return {
              ...view,
              destroy: () => {
                element.removeEventListener('keydown', key);
                view.destroy?.();
              },
            };
          };
        },
      })
      .configure({
        katexOptions: formulaOptions,
        onClick: (node, pos) =>
          edit?.({ latex: node.attrs.latex, block: node.type.name === 'blockMath', pos }),
      }),
  );
}
