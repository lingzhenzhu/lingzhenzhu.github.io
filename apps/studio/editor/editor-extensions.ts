import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { NotebookParagraph, NotebookHeading } from './notebook-nodes';
import { EditorialImage } from './editorial-image';
import { HeadingAnchors } from './heading-anchors';
/** The Markdown dependency is confined to this editing adapter; persisted data is validated RichNode JSON. */
export function editorExtensions(id: string) {
  return [
    StarterKit.configure({
      heading: false,
      paragraph: false,
      link: { openOnClick: false, protocols: ['https', 'mailto'], defaultProtocol: 'https' },
    }),
    NotebookParagraph,
    NotebookHeading.configure({ levels: [2, 3, 4, 5, 6] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    EditorialImage,
    Markdown,
    HeadingAnchors.configure({ prefix: id }),
  ];
}
