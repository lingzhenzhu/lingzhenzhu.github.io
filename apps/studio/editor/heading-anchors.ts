import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/** Heading IDs belong to content, not the editor's transient DOM. */
export const HeadingAnchors = Extension.create<{ prefix: string }>({
  name: 'headingAnchors',
  addOptions: () => ({ prefix: 'section' }),
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.id || null,
            renderHTML: (attributes: Record<string, unknown>) => (attributes.id ? { id: attributes.id } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    const prefix = this.options.prefix;
    return [
      new Plugin({
        appendTransaction(transactions, _previous, state) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          const ids = new Set<string>();
          const reserved = new Set<string>();
          state.doc.descendants((node) => {
            if (node.type.name === 'heading' && node.attrs.id) reserved.add(node.attrs.id);
          });
          const transaction = state.tr;
          state.doc.descendants((node, position) => {
            if (node.type.name !== 'heading') return;
            const existing = typeof node.attrs.id === 'string' ? node.attrs.id : '';
            if (existing && !ids.has(existing)) {
              ids.add(existing);
              return;
            }
            const slug =
              node.textContent
                .normalize('NFKC')
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]+/gu, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 60) || 'heading';
            const base = prefix + '-' + slug;
            let id = base,
              suffix = 2;
            while (ids.has(id) || reserved.has(id)) id = base + '-' + suffix++;
            ids.add(id);
            transaction.setNodeMarkup(position, undefined, { ...node.attrs, id });
          });
          return transaction.docChanged ? transaction : null;
        },
      }),
    ];
  },
});
