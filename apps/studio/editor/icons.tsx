export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    more: 'M4 12h.01M12 12h.01M20 12h.01',
    logout: 'M9 4H3v16h6M10 12h11m-4-4 4 4-4 4',
    sidebar: 'M3 4h18v16H3zM9 4v16',
    history: 'M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v5l3 2',
    research: 'M9 3h6M10 3v7l-6 9c-1 2 0 2 2 2h12c2 0 3 0 2-2l-6-9V3M7 16h10',
    teaching: 'm2 9 10-5 10 5-10 5-10-5Zm4 2v7c4 3 8 3 12 0v-7M22 9v8',
    media: 'M3 4h18v16H3zM10 8l6 4-6 4V8Z',
    archive: 'M3 3h18v5H3zM5 8v13h14V8M9 12h6',
    refresh: 'M20 7a9 9 0 1 0 1 9M20 2v6h-6',
    external: 'M14 3h7v7M21 3 10 14M10 4H3v17h17v-7',
    add: 'M12 5v14M5 12h14',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
    cloudflare: 'M2 16h13l1-3a5 5 0 0 0-9-4 3 3 0 0 0-4 3 3 3 0 0 0-1 4Zm15 0h5a4 4 0 0 0-5-5M2 19h20',
    // The three flame pieces of the Firebase mark, separated along their two seams.
    firebase:
      'M12 21.5 5 17.9 7.4 2.7l2.8 4L12 4.9l1.9 3.3 2.9-1.8L19 17.9ZM10.2 6.7 5.5 14.9M16.8 6.4 5 17.9',
    link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
    news: 'M4 4h13v17H4zM17 8h4v13h-4M7 8h7M7 12h7M7 16h5',
    medium:
      'M7.5 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM16.5 7.5c-1.1 0-2 2-2 4.5s.9 4.5 2 4.5 2-2 2-4.5-.9-4.5-2-4.5ZM21 8v8',
    text: 'M4 7V4h16v3M12 4v16M8.5 20h7',
    gallery: 'M3 7h14v14H3zM7 3h14v14M3 18l4-4 4 4 2-2 4 4M12.5 11h.01',
    portrait:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6.3 18c1.3-1.9 3.3-2.9 5.7-2.9s4.4 1 5.7 2.9',
    contact: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    podcast:
      'M12 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 16v5M7.8 15.7a6 6 0 1 1 8.4 0M5.2 18.4a9.6 9.6 0 1 1 13.6 0',
    chevron: 'm9 6 6 6-6 6',
    alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
    up: 'm6 13 6-6 6 6M12 7v13',
    down: 'm6 11 6 6 6-6M12 17V4',
    move: 'M4 5h7v14H4zM14 12h7m-3-3 3 3-3 3',
    copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    check: 'm5 12 4 4L19 6',
    preview: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    pages: 'M5 3h10l4 4v14H5V3Zm9 0v5h5M8 12h8M8 16h6',
    articles: 'M4 21h16M4 16l2-5L16 1l5 5-10 10-5 2ZM13 4l5 5',
    structure: 'M4 4h16v4H4zM4 12h6v8H4zM14 12h6v8h-6z',
    image: 'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
    arrow: 'm9 5 7 7-7 7',
    back: 'm15 5-7 7 7 7',
    undo: 'M9 4 3 10l6 6M3 10h11a7 7 0 0 1 7 7',
    redo: 'm15 4 6 6-6 6M21 10H10a7 7 0 0 0-7 7',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
    globe: 'M3 12h18M12 3c6 5 6 13 0 18-6-5-6-13 0-18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    publish: 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7',
  };
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.pages} />
    </svg>
  );
}
