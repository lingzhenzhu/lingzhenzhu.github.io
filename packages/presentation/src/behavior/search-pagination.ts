/** Compact page numbers with a stable first/last destination. */
export function paginationItems(current: number, total: number): (number | 'gap')[] {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (page) => total <= 7 || page === 1 || page === total || Math.abs(page - current) <= 1,
  );
  return pages.flatMap((page, index) => (index && page - pages[index - 1] > 1 ? ['gap', page] : [page])) as (
    number | 'gap'
  )[];
}
export function renderPagination(
  root: HTMLElement,
  current: number,
  total: number,
  onChange: (page: number) => void,
) {
  root.replaceChildren();
  root.hidden = total <= 1;
  const button = (label: string, page: number, arrow?: 'previous' | 'next') => {
    const el = document.createElement('button');
    el.type = 'button';
    el.setAttribute(
      'aria-label',
      arrow ? `${arrow === 'previous' ? 'Previous' : 'Next'} page` : `Page ${page}`,
    );
    if (arrow) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', arrow === 'previous' ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6');
      svg.appendChild(path);
      el.appendChild(svg);
      el.disabled = page < 1 || page > total;
    } else {
      el.textContent = label;
      if (page === current) el.setAttribute('aria-current', 'page');
    }
    el.addEventListener('click', () => onChange(page));
    root.appendChild(el);
  };
  button('', current - 1, 'previous');
  for (const item of paginationItems(current, total)) {
    if (item === 'gap') {
      const gap = document.createElement('span');
      gap.textContent = '…';
      gap.setAttribute('aria-hidden', 'true');
      root.appendChild(gap);
    } else button(String(item), item);
  }
  button('', current + 1, 'next');
}
