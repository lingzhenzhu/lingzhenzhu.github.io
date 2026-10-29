import React, { type ReactNode } from 'react';
import { safeUrl, type RichNode } from '@lzzhu/content';
import { useAssetUrl, responsiveImage } from './asset-context';
export function RichText({ node }: { node: RichNode }): ReactNode {
  let previous = 1;
  const outline = (item: RichNode): RichNode => {
    let attrs = item.attrs;
    if (item.type === 'heading') {
      const visual = Math.max(2, Math.min(6, Number(attrs?.level) || 2));
      previous = Math.min(visual, previous + 1);
      attrs = { ...attrs, level: previous, visualLevel: visual };
    }
    return { ...item, attrs, content: item.content?.map(outline) };
  };
  return <RichTextNode node={outline(node)} />;
}
function RichTextNode({ node }: { node: RichNode }): ReactNode {
  const assetUrl = useAssetUrl();
  const children = node.content?.map((child, index) => <RichTextNode key={index} node={child} />);
  const attrs = node.attrs || {};
  switch (node.type) {
    case 'doc':
      return <>{children}</>;
    case 'text': {
      let text: ReactNode = node.text || '';
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') text = <strong>{text}</strong>;
        if (mark.type === 'italic') text = <em>{text}</em>;
        if (mark.type === 'underline') text = <u>{text}</u>;
        if (mark.type === 'strike') text = <s>{text}</s>;
        if (mark.type === 'code') text = <code>{text}</code>;
        if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && safeUrl(mark.attrs.href))
          text = (
            <a href={mark.attrs.href} rel="noopener noreferrer">
              {text}
            </a>
          );
      }
      return text;
    }
    case 'paragraph':
      return (
        <p
          style={
            ['center', 'right', 'justify'].includes(String(attrs.textAlign))
              ? { textAlign: attrs.textAlign as 'center' | 'right' | 'justify' }
              : undefined
          }
        >
          {children}
        </p>
      );
    case 'heading': {
      const level = Math.max(2, Math.min(6, Number(attrs.level) || 2));
      return React.createElement(
        'h' + level,
        {
          id: typeof attrs.id === 'string' ? attrs.id : undefined,
          'data-heading-level': attrs.visualLevel,
          style: ['center', 'right', 'justify'].includes(String(attrs.textAlign))
            ? { textAlign: attrs.textAlign }
            : undefined,
        },
        children,
      );
    }
    case 'hardBreak':
      return <br />;
    case 'horizontalRule':
      return <hr />;
    case 'bulletList':
      return <ul>{children}</ul>;
    case 'taskList':
      return <ul className="content-checklist">{children}</ul>;
    case 'taskItem':
      return (
        <li className="content-task">
          <span role="img" aria-label={attrs.checked ? 'Completed' : 'Not completed'}>
            {attrs.checked ? '☑' : '☐'}
          </span>
          <div>{children}</div>
        </li>
      );
    case 'orderedList':
      return <ol start={typeof attrs.start === 'number' ? attrs.start : undefined}>{children}</ol>;
    case 'listItem':
      return <li>{children}</li>;
    case 'blockquote':
      return <blockquote>{children}</blockquote>;
    case 'codeBlock':
      return (
        <pre>
          <code>{children}</code>
        </pre>
      );
    case 'image':
      return typeof attrs.src === 'string' && safeUrl(attrs.src, true) ? (
        <img
          src={assetUrl(attrs.src)}
          {...responsiveImage(attrs.src, 700, assetUrl)}
          alt={String(attrs.alt || '')}
          loading="lazy"
          decoding="async"
        />
      ) : null;
    default:
      return null;
  }
}
