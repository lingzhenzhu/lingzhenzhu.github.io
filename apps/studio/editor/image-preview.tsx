import { safeUrl } from '@lzzhu/content';

export function editorImageSource(src: string) {
  return src.startsWith('/assets/uploads/')
    ? src.replace('/assets/uploads/', '/admin/api/assets/')
    : src.startsWith('/assets/')
      ? src.replace('/assets/', '/admin/assets/')
      : src;
}
export function remotePreview(src: string, alt: string) {
  return '/admin/image-preview?' + new URLSearchParams({ src, alt });
}
export function ImagePreview({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!safeUrl(src, true)) return null;
  return /^https:/i.test(src) ? (
    <iframe
      className={className}
      title={alt || 'Image preview'}
      src={remotePreview(src, alt)}
      sandbox=""
      tabIndex={-1}
      style={{ border: 0 }}
    />
  ) : (
    <img className={className} src={editorImageSource(src)} alt={alt} />
  );
}
