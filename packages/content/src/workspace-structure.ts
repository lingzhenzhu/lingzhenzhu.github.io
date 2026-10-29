export type PageIdentity = { id: string; path: string; status: string };
/** Cross-page rules shared by full imports and incremental transactions. */
export function workspaceIssues(pages: PageIdentity[]) {
  const issues: string[] = [];
  if (pages.length > 2000) issues.push('A workspace can contain at most 2000 pages.');
  for (const field of ['id', 'path'] as const)
    if (new Set(pages.map((page) => page[field])).size !== pages.length)
      issues.push('Page ' + field + ' must be unique');
  const decoded = pages.map((page) => {
    try {
      return decodeURI(page.path).normalize('NFC');
    } catch {
      return page.path;
    }
  });
  if (new Set(decoded).size !== decoded.length) issues.push('Page paths resolve to the same URL');
  if (!pages.some((page) => page.path === '/' && page.status === 'published'))
    issues.push('The homepage must remain published');
  return issues;
}
