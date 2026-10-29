export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    add: 'M12 5v14M5 12h14',
    cloudflare: 'M2 16h13l1-3a5 5 0 0 0-9-4 3 3 0 0 0-4 3 3 3 0 0 0-1 4Zm15 0h5a4 4 0 0 0-5-5M2 19h20',
    firebase: 'm4 18 2-15 5 9 3-7 6 13-8 4-8-4Zm0 0 7-6 9 6M6 3l6 10',
    link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
    news: 'M4 4h13v17H4zM17 8h4v13h-4M7 8h7M7 12h7M7 16h5',
    medium: 'M3 6v12M3 6l5 8 5-8v12M18 6h3M18 18h3M19.5 6v12',
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
