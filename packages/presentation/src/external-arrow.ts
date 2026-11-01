/** Shared geometry for server markup and the framework-free feed refresh. */
export const externalArrowPath = 'M5 19 19 5M5 5h14v14';

export function createExternalArrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'external-arrow');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', externalArrowPath);
  svg.appendChild(path);
  return svg;
}
