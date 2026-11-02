import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { Editor } from '@tiptap/core';
import { createLowlight } from 'lowlight';

// Grammars are a large download that most articles never need. The editor starts with plain text
// and loads the shared set the first time a document contains a code block.
const editorHighlighter = createLowlight();
editorHighlighter.register({ plaintext: () => ({ contains: [] }) });
let grammars: Promise<void> | undefined;
function highlightWhenNeeded(editor: Editor) {
  if (grammars) return;
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock') found = true;
    return !found;
  });
  if (!found) return;
  grammars = import('lowlight').then(({ common }) => {
    editorHighlighter.register(common);
    if (editor.isDestroyed) return;
    // Re-setting a code block's own attributes is how the highlighter is asked to recompute.
    const { tr } = editor.state;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'codeBlock') tr.setNodeMarkup(pos, undefined, node.attrs);
    });
    editor.view.dispatch(tr.setMeta('addToHistory', false));
  });
}
export const EditorialCode = CodeBlockLowlight.extend({
  onCreate() {
    highlightWhenNeeded(this.editor);
  },
  onUpdate() {
    highlightWhenNeeded(this.editor);
  },
  renderMarkdown(node) {
    const source = node.content?.map((child) => child.text || '').join('') || '';
    // A code sample can itself contain Markdown fences. Its wrapper must be longer.
    const longest = Math.max(2, ...[...source.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = '`'.repeat(longest + 1);
    return fence + (node.attrs?.language || '') + '\n' + source + '\n' + fence;
  },
}).configure({ lowlight: editorHighlighter, defaultLanguage: 'plaintext' });
