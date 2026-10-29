import { safeUrl, type Content, type RichNode } from '@lzzhu/content';

export function imageOrigin(src: string): string | undefined {
  if (!safeUrl(src, true)) return;
  try {
    const url = new URL(src);
    if (url.protocol === 'https:' && !/[;'"\s*<>`]/.test(url.origin)) return url.origin;
  } catch {
    /* Local images already use the self source. */
  }
}

/** Only origins used by image fields enter a preview's policy; links grant no permission. */
export function previewImageOrigins(content: Content) {
  const sources = [content.settings.logo];
  const visit = (node: RichNode) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') sources.push(node.attrs.src);
    node.content?.forEach(visit);
  };
  for (const page of content.pages) {
    if (page.homeHero?.image?.source === 'custom') sources.push(page.homeHero.image.src);
    for (const block of page.blocks) {
      if (block.type === 'image' || block.type === 'profile') sources.push(block.src);
      if (block.type === 'richText') visit(block.document);
      if (block.type === 'teaching' && block.logo) sources.push(block.logo);
      if (block.type === 'gallery') block.photos.forEach(photo => sources.push(photo.src));
      if (block.type === 'research') block.parts.forEach(part => part.type === 'image' ? sources.push(part.src) : visit(part.document));
    }
  }
  for (const entry of content.medium) {
    if (entry.cover) sources.push(entry.cover);
    if (entry.coverOverride) sources.push(entry.coverOverride);
  }
  return [...new Set(sources.map(imageOrigin).filter((origin): origin is string => !!origin))];
}

export function studioPolicy(imageOrigins: string[] = [], isolatedImage = false) {
  const origins = imageOrigins.filter((origin) => imageOrigin(origin) === origin);
  if (isolatedImage)
    return `default-src 'none'; img-src ${origins.join(' ') || "'none'"}; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox`;
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://miro.medium.com https://cdn-images-1.medium.com blob: ${origins.join(' ')}; font-src 'self'; connect-src 'self'; frame-src 'self' https://embed.podcasts.apple.com; frame-ancestors 'self'; form-action 'self'; base-uri 'none'; object-src 'none'`;
}
