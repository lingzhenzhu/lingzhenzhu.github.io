import { useEffect, useState } from 'react';

type Route = { section: string; pageId?: string; collection?: 'pages' | 'articles' };
const sections = new Set(['pages', 'structure', 'articles', 'assets', 'settings', 'rewards', 'history']);
function readRoute(): Route {
  const value = location.hash.slice(1);
  if (value.startsWith('pages/') || value.startsWith('articles/')) {
    try {
      return {
        section: 'pages',
        collection: value.startsWith('articles/') ? 'articles' : 'pages',
        pageId: decodeURIComponent(value.slice(value.indexOf('/') + 1)),
      };
    } catch {}
  }
  return { section: sections.has(value) ? value : 'pages' };
}
/** Canonical routes keep sidebar shortcuts, breadcrumbs, reload and Back in agreement. */
export function useWorkspaceNavigation(onNavigate: () => void) {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const changed = () => {
      setRoute(readRoute());
      onNavigate();
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, [onNavigate]);
  const navigate = (next: Route) => {
    const hash = next.pageId
      ? '#' + (next.collection || 'pages') + '/' + encodeURIComponent(next.pageId)
      : '#' + next.section;
    if (location.hash !== hash) history.pushState(null, '', hash);
    setRoute(next);
    onNavigate();
  };
  return {
    section: route.section,
    selected: route.pageId,
    go: (section: string) => navigate({ section }),
    openPage: (pageId: string, article = false) =>
      navigate({ section: 'pages', pageId, collection: article ? 'articles' : 'pages' }),
  };
}
