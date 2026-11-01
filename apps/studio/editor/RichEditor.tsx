import { Select } from './Select';
import { Button } from './controls';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { editorExtensions } from './editor-extensions';
import { FormatPicker, NotebookTools, NoteIcon } from './NotebookChrome';
import { useNotebookRuling } from './useNotebookRuling';
import './notebook.css';
import { safeUrl, type RichNode } from '@lzzhu/content';
import { Dialog } from './ui';
import { ImagePicker } from './ImagePicker';
import { markdownDocument } from './markdown-document';
import type { ImageTools } from './ImageField';
import { FormulaDialog, type FormulaDraft } from './FormulaDialog';
import { formulaMarkdown } from './editor-mathematics';
import { codeLanguages, codeLanguageLabel } from '@lzzhu/presentation/code-languages';
import 'katex/dist/katex.min.css';
import '@lzzhu/presentation/styles/technical-text.css';

export function RichEditor({
  document,
  id,
  onChange,
  upload,
}: {
  document: RichNode;
  id: string;
  onChange: (document: RichNode) => void;
} & Partial<ImageTools>) {
  const [linkUrl, setLinkUrl] = useState<string>();
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich'),
    [source, setSource] = useState(''),
    [sourceNotice, setSourceNotice] = useState('');
  const [picking, setPicking] = useState(false);
  const [formula, setFormula] = useState<FormulaDraft>();
  const formulaTrigger = useRef<HTMLElement | null>(null);
  const imageTrigger = useRef<HTMLButtonElement>(null);
  const linkTrigger = useRef<HTMLButtonElement>(null);
  const markdownInput = useRef<HTMLTextAreaElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const latestChange = useRef(onChange),
    emittedDocument = useRef<RichNode | undefined>(undefined);
  latestChange.current = onChange;
  // A single scrolling paper surface keeps text and its ruling together.
  useLayoutEffect(() => {
    const field = markdownInput.current;
    if (!field) return;
    const fit = () => {
      field.style.height = '0px';
      field.style.height = Math.max(320, field.scrollHeight) + 'px';
    };
    fit();
    let previousWidth = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== previousWidth) {
        previousWidth = field.clientWidth;
        fit();
      }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [mode, source]);
  const editor = useEditor(
    {
      extensions: editorExtensions(id, (value) => {
        formulaTrigger.current = window.document.activeElement as HTMLElement;
        setFormula(value);
      }),
      content: document,
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      onUpdate: ({ editor }) => {
        const value = editor.getJSON() as RichNode;
        emittedDocument.current = value;
        latestChange.current(value);
      },
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Content editor',
          class: 'rich-editor',
        },
      },
    },
    [id],
  );
  useEffect(() => {
    if (document === emittedDocument.current) return;
    if (editor && JSON.stringify(document) !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(document, { emitUpdate: false });
      setSource(editor.getMarkdown());
    }
  }, [document, editor]);
  useNotebookRuling(paper, editor, mode);
  if (!editor) return null;
  const updateMarkdown = (value: string) => {
    setSource(value);
    try {
      editor.commands.setContent(
        markdownDocument(editor.markdown!.parse(value), editor.getJSON() as RichNode),
      );
      setSourceNotice('');
    } catch {
      // Keep the last valid document; flattening it would autosave an article without its formatting.
      setSourceNotice(
        'This Markdown has an unsupported link or image address. Correct it to apply your changes.',
      );
    }
  };
  return (
    <div className="rich-editor-wrap writing-paper" ref={paper} data-mode={mode}>
      <div className="note-topbar">
        <div className="note-history">
          <Button
            variant="quiet"
            compactIcons="keep"
            type="button"
            aria-label="Undo"
            title="Undo"
            disabled={!editor.can().undo()}
            onClick={() => {
              editor.chain().undo().run();
              if (mode === 'markdown') setSource(editor.getMarkdown());
            }}
          >
            <NoteIcon name="undo" />
          </Button>
          <Button
            variant="quiet"
            compactIcons="keep"
            type="button"
            aria-label="Redo"
            title="Redo"
            disabled={!editor.can().redo()}
            onClick={() => {
              editor.chain().redo().run();
              if (mode === 'markdown') setSource(editor.getMarkdown());
            }}
          >
            <NoteIcon name="redo" />
          </Button>
        </div>
        <Button
          variant="quiet"
          compactIcons="keep"
          type="button"
          aria-label="Image"
          title="Insert image"
          ref={imageTrigger}
          onClick={() => setPicking(true)}
        >
          <NoteIcon name="image" />
        </Button>
      </div>
      <div className="note-metadata">
        <span>{editor.getText().trim().length.toLocaleString()} characters</span>
        {mode === 'rich' && editor.isActive('codeBlock') && (
          <label className="code-language">
            Language
            <Select
              aria-label="Code language"
              value={editor.getAttributes('codeBlock').language || 'plaintext'}
              onChange={(e) =>
                editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()
              }
            >
              {codeLanguages.map((language) => (
                <option key={language} value={language}>
                  {codeLanguageLabel(language)}
                </option>
              ))}
              {!codeLanguages.includes(editor.getAttributes('codeBlock').language || 'plaintext') && (
                <option value={editor.getAttributes('codeBlock').language}>
                  {editor.getAttributes('codeBlock').language}
                </option>
              )}
            </Select>
          </label>
        )}
        <FormatPicker
          mode={mode}
          onChange={(next) => {
            // Unapplied Markdown would be discarded by switching views.
            if (next === 'rich' && sourceNotice) return markdownInput.current?.focus();
            if (next === 'markdown') setSource(editor.getMarkdown());
            setMode(next);
            setSourceNotice('');
          }}
        />
      </div>
      <div className="note-paper-body">
        {mode === 'rich' && <EditorContent editor={editor} />}
        {mode === 'markdown' && (
          <>
            <textarea
              ref={markdownInput}
              className="markdown-editor"
              aria-label="Markdown editor"
              value={source}
              spellCheck={false}
              onChange={(event) => {
                updateMarkdown(event.target.value);
              }}
            />
            {sourceNotice && (
              <p role="status" className="field-help">
                {sourceNotice}
              </p>
            )}
          </>
        )}
      </div>
      <NotebookTools
        editor={editor}
        mode={mode}
        linkRef={linkTrigger}
        onLink={() => setLinkUrl(editor.getAttributes('link').href || 'https://')}
        onFormula={(trigger) => {
          formulaTrigger.current = trigger;
          const field = markdownInput.current;
          const selected =
            mode === 'markdown' && field
              ? source.slice(field.selectionStart, field.selectionEnd)
              : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
          setFormula({ latex: selected || 'E = mc^2', block: false });
        }}
        insertMarkdown={(before, after = '') => {
          const field = markdownInput.current;
          if (!field) return;
          const start = field.selectionStart,
            end = field.selectionEnd;
          updateMarkdown(
            source.slice(0, start) + before + source.slice(start, end) + after + source.slice(end),
          );
          requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(start + before.length, end + before.length);
          });
        }}
      />
      <div className="notebook-footer">{mode === 'rich' ? 'Rich text' : 'Markdown'}</div>
      {formula && (
        <FormulaDialog
          value={formula}
          trigger={formulaTrigger.current}
          onClose={() => setFormula(undefined)}
          onApply={(value) => {
            if (mode === 'markdown') {
              const field = markdownInput.current;
              const start = field?.selectionStart ?? source.length,
                end = field?.selectionEnd ?? start;
              const after = source.slice(end);
              const markup = value.block
                ? '\n\n' + formulaMarkdown(value.latex, true) + '\n\n'
                : formulaMarkdown(value.latex, false, after);
              updateMarkdown(source.slice(0, start) + markup + after);
            } else if (value.pos !== undefined) {
              if (value.block)
                editor.chain().focus().updateBlockMath({ latex: value.latex, pos: value.pos }).run();
              else editor.chain().focus().updateInlineMath({ latex: value.latex, pos: value.pos }).run();
            } else {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: value.block ? 'blockMath' : 'inlineMath',
                  attrs: { latex: value.latex },
                })
                .run();
            }
            setFormula(undefined);
          }}
        />
      )}
      {picking && (
        <ImagePicker
          upload={upload}
          returnFocusTo={imageTrigger.current}
          onClose={() => setPicking(false)}
          onChoose={(src) => {
            if (mode === 'markdown') {
              const field = markdownInput.current;
              const start = field?.selectionStart ?? source.length,
                end = field?.selectionEnd ?? start;
              updateMarkdown(
                source.slice(0, start) +
                  '\n\n![](' +
                  encodeURI(src).replaceAll('(', '%28').replaceAll(')', '%29') +
                  ')\n\n' +
                  source.slice(end),
              );
            } else editor.chain().focus().setImage({ src, alt: '' }).run();
          }}
        />
      )}
      {linkUrl !== undefined && (
        <Dialog title="Edit link" onClose={() => setLinkUrl(undefined)} returnFocusTo={linkTrigger.current}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (linkUrl && !safeUrl(linkUrl)) return;
              if (linkUrl) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
              else editor.chain().focus().extendMarkRange('link').unsetLink().run();
              setLinkUrl(undefined);
            }}
          >
            <label>
              Link address
              <input
                autoFocus
                data-dialog-focus
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
              />
            </label>
            <p className="field-help">
              Use a website address, email link or page on this site. Leave empty to remove the link.
            </p>
            {linkUrl && !safeUrl(linkUrl) && (
              <p role="alert">Enter a valid https://, mailto: or site address.</p>
            )}
            <div className="dialog-actions">
              <Button compactIcons="keep" type="button" onClick={() => setLinkUrl(undefined)}>
                Cancel
              </Button>
              <Button
                compactIcons="keep"
                className="primary"
                type="submit"
                disabled={!!linkUrl && !safeUrl(linkUrl)}
              >
                Apply link
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
