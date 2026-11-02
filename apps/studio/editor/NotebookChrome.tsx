import { Button } from './controls';
import type { ButtonProps } from './Button';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { Icon } from './icons';
export type WritingMode = 'rich' | 'markdown';
type FormatAction = {
  name: string;
  icon: string;
  /** What the button shows in Markdown mode. */
  source: string;
  active?: boolean;
  action: () => void;
  before: string;
  after?: string;
};
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
    formula: 'M20 4H8l7 8-7 8h12M3 10h5M3 14h5',
    code: 'm8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',
    italic: 'M10 3h10M4 21h10M15 3 9 21',
    underline: 'M6 3v8a6 6 0 0 0 12 0V3M4 21h16',
  };
  // Solid letterforms share the toolbar's weight with the 2.3 stroke icons.
  const solid: Record<string, string> = {
    heading: 'M4 3h4v7h8V3h4v18h-4v-7H8v7H4z',
    quote: 'M3 13C3 6 6 3 11 3v4c-3 0-4 2-4 4h4v10H3zm12 0c0-7 3-10 8-10v4c-3 0-4 2-4 4h4v10h-8z',
    paragraph: 'M10 3h11v3h-2v15h-3V6h-2v15h-3v-8h-1a5 5 0 0 1 0-10z',
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
      {solid[name] ? (
        <path fill="currentColor" stroke="none" d={solid[name]} />
      ) : name === 'bold' ? (
        <path d="M6 3v18h7c7 0 7-9 0-9H6h6c6 0 6-9 0-9H6" strokeWidth="3" />
      ) : name === 'h3' ? (
        <>
          <path fill="currentColor" stroke="none" d="M2 4h3.2v6.4h5.6V4H14v16h-3.2v-6.4H5.2V20H2z" />
          <path d="M16.5 9.5h5l-3 3.5c2 0 3.2 1.1 3.2 2.9s-1.4 3.1-3.2 3.1c-1.2 0-2.2-.5-2.8-1.3" />
        </>
      ) : name === 'numbered' ? (
        <>
          <path d="M10 5h11M10 12h11M10 19h11" />
          <path
            strokeWidth="1.8"
            d="M3.5 3.5 5 2.8V8M3.4 8h3.2M3.4 11.6c.2-.8.8-1.3 1.6-1.3s1.5.6 1.5 1.4c0 1.4-3.1 2.4-3.1 3.6h3.2M3.4 17.6h3l-1.6 1.7c1 0 1.7.5 1.7 1.3S5.8 22 4.9 22c-.7 0-1.2-.3-1.5-.7"
          />
        </>
      ) : (
        <path d={paths[name] || paths.more} />
      )}
    </svg>
  );
}
/** Every toolbar action, primary or under More: an icon over its name in rich text,
 * the Markdown it inserts in source mode. */
function ToolButton({
  icon,
  label,
  source,
  mode,
  pressed,
  buttonRef,
  'aria-label': name = label,
  ...props
}: Omit<ButtonProps, 'children' | 'icon'> & {
  icon: string;
  label: string;
  source?: string;
  mode: WritingMode;
  pressed?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const showSource = mode === 'markdown' && source;
  return (
    <Button
      {...props}
      ref={buttonRef}
      variant="quiet"
      compactIcons="keep"
      type="button"
      aria-label={name}
      aria-pressed={mode === 'rich' ? pressed : undefined}
    >
      {showSource ? (
        <span>{source}</span>
      ) : (
        <>
          <NoteIcon name={icon} />
          <small>{label}</small>
        </>
      )}
    </Button>
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
        <span className="format-chevron">
          <Icon name="arrow" />
        </span>
      </summary>
      <div className="format-popover" data-glass="popover" role="group" aria-label="Formatting mode">
        <p>Choose formatting mode</p>
        {(['rich', 'markdown'] as const).map((value) => (
          <Button
            variant="quiet"
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
              {mode === value && <Icon name="check" />}
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
  onFormula,
}: {
  editor: Editor;
  mode: WritingMode;
  insertMarkdown: (before: string, after?: string) => void;
  onLink: () => void;
  linkRef: RefObject<HTMLButtonElement | null>;
  onFormula: (trigger: HTMLButtonElement) => void;
}) {
  const [more, setMore] = useState(false);
  const actions: FormatAction[] = [
    {
      name: 'Heading',
      icon: 'heading',
      source: '# Heading',
      active: editor.isActive('heading'),
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      before: '## ',
    },
    {
      name: 'Center',
      icon: 'center',
      source: '[Center]',
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
      source: '- List',
      active: editor.isActive('bulletList'),
      action: () => editor.chain().focus().toggleBulletList().run(),
      before: '- ',
    },
    {
      name: 'Bold',
      icon: 'bold',
      source: '**Bold**',
      active: editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
      before: '**',
      after: '**',
    },
    {
      name: 'Quote',
      icon: 'quote',
      source: '> Quote',
      active: editor.isActive('blockquote'),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      before: '> ',
    },
    {
      name: 'Checklist',
      icon: 'check',
      source: '☐ Task',
      active: editor.isActive('taskList'),
      action: () => editor.chain().focus().toggleTaskList().run(),
      before: '- [ ] ',
    },
  ];
  const extras: FormatAction[] = [
    {
      name: 'Italic',
      icon: 'italic',
      source: '*Italic*',
      active: editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
      before: '*',
      after: '*',
    },
    {
      name: 'Underline',
      icon: 'underline',
      source: '<u>U</u>',
      active: editor.isActive('underline'),
      action: () => editor.chain().focus().toggleUnderline().run(),
      before: '<u>',
      after: '</u>',
    },
    {
      name: 'Paragraph',
      icon: 'paragraph',
      source: '¶ Paragraph',
      action: () => editor.chain().focus().setParagraph().run(),
      before: '\n\n',
    },
    {
      name: 'H3',
      icon: 'h3',
      source: '### H3',
      active: editor.isActive('heading', { level: 3 }),
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      before: '### ',
    },
    {
      name: 'Numbered list',
      icon: 'numbered',
      source: '1. List',
      active: editor.isActive('orderedList'),
      action: () => editor.chain().focus().toggleOrderedList().run(),
      before: '1. ',
    },
  ];
  const tool = (action: FormatAction) => (
    <ToolButton
      key={action.name}
      mode={mode}
      icon={action.icon}
      label={action.name}
      source={action.source}
      pressed={action.active}
      onClick={() => (mode === 'rich' ? action.action() : insertMarkdown(action.before, action.after))}
    />
  );
  // Both rows share one column width, so the extra tools line up under the primary ones.
  const columns = actions.length + 3;
  return (
    <div className={'notebook-tools ' + mode} style={{ '--tool-columns': columns } as CSSProperties}>
      <div
        className="note-tool-row"
        role="toolbar"
        aria-label={mode === 'rich' ? 'Text formatting' : 'Markdown shortcuts'}
      >
        {actions.map(tool)}
        <ToolButton
          mode={mode}
          icon="code"
          label="Code"
          onClick={() =>
            mode === 'rich'
              ? editor.chain().focus().toggleCodeBlock().run()
              : insertMarkdown('```\n', '\n```')
          }
        />
        <ToolButton
          mode={mode}
          icon="formula"
          label="Formula"
          onClick={(event) => onFormula(event.currentTarget)}
        />
        <ToolButton
          mode={mode}
          icon="more"
          label="More"
          aria-label="More formatting"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        />
      </div>
      {more && (
        <div className="note-tool-row note-extra-tools" role="toolbar" aria-label="More text formatting">
          {extras.map(tool)}
          <ToolButton
            mode={mode}
            icon="link"
            label="Link"
            buttonRef={linkRef}
            onClick={() => (mode === 'rich' ? onLink() : insertMarkdown('[', '](https://example.com)'))}
          />
        </div>
      )}
    </div>
  );
}
