import Image from '@tiptap/extension-image';
import { safeUrl } from '@lzzhu/content';
import { editorImageSource, remotePreview } from './image-preview';

/** Only the editor DOM changes; serialized JSON retains the public asset identifier. */
export const EditorialImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div');
      container.contentEditable = 'false';
      const src = String(node.attrs.src || '');
      const alt = String(node.attrs.alt || '');
      if (safeUrl(src, true)) {
        if (/^https:/i.test(src)) {
          const frame = document.createElement('iframe');
          frame.src = remotePreview(src, alt);
          frame.title = alt || 'Image preview';
          frame.setAttribute('sandbox', '');
          frame.tabIndex = -1;
          frame.style.cssText = 'border:0;width:100%;height:240px';
          container.appendChild(frame);
        } else {
          const image = document.createElement('img');
          image.src = editorImageSource(src);
          image.alt = alt;
          if (node.attrs.title) image.title = String(node.attrs.title);
          container.appendChild(image);
        }
      }
      return { dom: container };
    };
  },
});
