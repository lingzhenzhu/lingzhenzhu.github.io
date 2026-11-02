import { useLayoutEffect, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';

/** Align the ink, not the line box, with the paper's grid on every platform. */
export function useNotebookRuling(
  root: RefObject<HTMLDivElement | null>,
  editor: Editor | null,
  mode: string,
) {
  useLayoutEffect(() => {
    const paper = root.current;
    if (!paper || !editor) return;
    const context = document.createElement('canvas').getContext('2d')!;
    let frame = 0,
      alive = true;
    const baseline = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText('Hg');
      const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;
      return (parseFloat(style.lineHeight) - ascent - descent) / 2 + ascent;
    };
    const measure = () => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(paper);
        const metric = (name: string) => parseFloat(style.getPropertyValue(name));
        const target = metric('--note-grid') - metric('--note-rule-gap') - metric('--note-ink-gap');
        const paragraph = paper.querySelector<HTMLElement>('.rich-editor p');
        const heading = paper.querySelector<HTMLElement>('.rich-editor :is(h1,h2,h3,h4,h5,h6)');
        if (paragraph) paper.style.setProperty('--paragraph-offset', `${target - baseline(paragraph)}px`);
        if (heading) paper.style.setProperty('--heading-offset', `${target - baseline(heading)}px`);
        const source = paper.querySelector<HTMLTextAreaElement>('.markdown-editor');
        if (source) {
          source.style.setProperty(
            '--source-padding-top',
            `${metric('--note-padding') + target - baseline(source)}px`,
          );
          source.style.height = '0px';
          source.style.height = Math.max(350, source.scrollHeight) + 'px';
        }
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    editor.on('update', measure);
    void document.fonts.ready.then(measure);
    measure();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      editor.off('update', measure);
    };
  }, [root, editor, mode]);
}
