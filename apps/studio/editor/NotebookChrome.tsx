import { Button } from './controls';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
export type WritingMode = 'rich' | 'markdown';
export function NoteIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    undo: 'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14',
    redo: 'm16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14',
    image: 'M3 4h18v16H3zM3 17l6-7 5 5 3-3 4 4M17 8h.01',
    center: 'M5 4h14M3 9h18M6 14h12M3 19h18',
    list: 'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',
    check: 'M4 3h16v18H4zM8 11l3 3 5-6',
    link: 'M9 15l6-6M9 7l2-2a5 5 0 0 1 7 7l-2 2M15 17l-2 2a5 5 0 0 1-7-7l2-2',
    more: 'M4 12h.01M12 12h.01M20 12h.01',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="note-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {name === 'heading' ? (
        <path fill="currentColor" stroke="none" d="M4 3h4v7h8V3h4v18h-4v-7H8v7H4z" />
      ) : name === 'bold' ? (
        <path d="M6 3v18h7c7 0 7-9 0-9H6h6c6 0 6-9 0-9H6" strokeWidth="3" />
      ) : name === 'quote' ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M3 13C3 6 6 3 11 3v4c-3 0-4 2-4 4h4v10H3zm12 0c0-7 3-10 8-10v4c-3 0-4 2-4 4h4v10h-8z"
        />
      ) : (
        <path d={paths[name] || paths.more} />
      )}
    </svg>
  );
}
export function FormatPicker({
  mode,
  onChange,
}: {
  mode: WritingMode;
  onChange: (mode: WritingMode) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return (
    <details
      ref={ref}
      className="format-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          ref.current?.removeAttribute('open');
          ref.current?.querySelector('summary')?.focus();
        }
      }}
    >
      <summary role="button" aria-label="Choose formatting mode">
        <span className={'format-badge ' + mode}>{mode === 'rich' ? 'RTF' : 'M↓'}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="format-popover" role="group" aria-label="Formatting mode">
        <p>Choose formatting mode</p>
        {(['rich', 'markdown'] as const).map((value) => (
          <Button
            compactIcons="keep"
            key={value}
            type="button"
            aria-label={value === 'rich' ? 'Rich text' : 'Markdown'}
            aria-pressed={mode === value}
            onClick={() => {
              onChange(value);
              ref.current?.removeAttribute('open');
              ref.current?.querySelector('summary')?.focus();
            }}
          >
            <span className={'format-badge ' + value}>{value === 'rich' ? 'RTF' : 'M↓'}</span>
            <span>{value === 'rich' ? 'Rich text' : 'Markdown'}</span>
            <span className="format-check" aria-hidden="true">
              {mode === value ? '✓' : ''}
            </span>
          </Button>
        ))}
      </div>
    </details>
  );
}
export function NotebookTools({
  editor,
  mode,
  insertMarkdown,
  onLink,
  linkRef,
}: {
  editor: Editor;
  mode: WritingMode;
  insertMarkdown: (before: string, after?: string) => void;
  onLink: () => void;
  linkRef: RefObject<HTMLButtonElement | null>;
}) {
  const [more, setMore] = useState(false);
  const actions = [
    {
      name: 'Heading',
      icon: 'heading',
      active: editor.isActive('heading'),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      before: '## ',
    },
    {
      name: 'Center',
      icon: 'center',
      active: editor.isActive({ textAlign: 'center' }),
      action: () =>
        editor
          .chain()
          .focus()
          .setTextAlign(editor.isActive({ textAlign: 'center' }) ? 'left' : 'center')
          .run(),
      before: '<p style="text-align:center">',
      after: '</p>',
    },
    {
      name: 'List',
      icon: 'list',
      active: editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
      before: '- ',
    },
    {
      name: 'Bold',
      icon: 'bold',
      active: editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
      before: '**',
      after: '**',
    },
    {
      name: 'Quote',
      icon: 'quote',
      active: editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      before: '> ',
    },
    {
      name: 'Checklist',
      icon: 'check',
      active: editor.isActive('taskList'),
      action: () => editor.chain().focus().toggleTaskList().run(),
      before: '- [ ] ',
    },
  ];
  return (
    <div className={'notebook-tools ' + mode}>
      <div
        className="note-primary-tools"
        role="toolbar"
        aria-label={mode === 'rich' ? 'Text formatting' : 'Markdown shortcuts'}
      >
        {actions.map((action) => (
          <Button
            compactIcons="keep"
            key={action.name}
            type="button"
            aria-label={action.name}
            aria-pressed={mode === 'rich' ? action.active : undefined}
            onClick={() => (mode === 'rich' ? action.action() : insertMarkdown(action.before, action.after))}
          >
            {mode === 'rich' ? (
              <>
                <NoteIcon name={action.icon} />
                <small>{action.name}</small>
              </>
            ) : (
              <span>
                {
                  {
                    Heading: '# Heading',
                    Center: '[Center]',
                    List: '- List',
                    Bold: '**Bold**',
                    Quote: '> Quote',
                    Checklist: '☐ Task',
                  }[action.name]
                }
              </span>
            )}
          </Button>
        ))}
        <Button
          compactIcons="keep"
          type="button"
          aria-label="More formatting"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          <NoteIcon name="more" />
          <small>More</small>
        </Button>
      </div>
      {more && (
        <div className="note-extra-tools" role="toolbar" aria-label="More text formatting">
          <Button
            compactIcons="keep"
            aria-label="Italic"
            onClick={() =>
              mode === 'rich' ? editor.chain().focus().toggleItalic().run() : insertMarkdown('*', '*')
            }
          >
            <i>I</i>
          </Button>
          <Button
            compactIcons="keep"
            aria-label="Underline"
            onClick={() =>
              mode === 'rich' ? editor.chain().focus().toggleUnderline().run() : insertMarkdown('<u>', '</u>')
            }
          >
            <u>U</u>
          </Button>
          <Button
            compactIcons="keep"
            onClick={() =>
              mode === 'rich' ? editor.chain().focus().setParagraph().run() : insertMarkdown('\n\n')
            }
          >
            Paragraph
          </Button>
          <Button
            compactIcons="keep"
            onClick={() =>
              mode === 'rich'
                ? editor.chain().focus().toggleHeading({ level: 3 }).run()
                : insertMarkdown('### ')
            }
          >
            H3
          </Button>
          <Button
            compactIcons="keep"
            onClick={() =>
              mode === 'rich' ? editor.chain().focus().toggleOrderedList().run() : insertMarkdown('1. ')
            }
          >
            Numbered list
          </Button>
          <Button
            compactIcons="keep"
            onClick={() =>
              mode === 'rich'
                ? editor.chain().focus().toggleCodeBlock().run()
                : insertMarkdown('```\n', '\n```')
            }
          >
            Code
          </Button>
          <Button
            compactIcons="keep"
            ref={linkRef}
            onClick={() => (mode === 'rich' ? onLink() : insertMarkdown('[', '](https://example.com)'))}
          >
            Link
          </Button>
        </div>
      )}
    </div>
  );
}
