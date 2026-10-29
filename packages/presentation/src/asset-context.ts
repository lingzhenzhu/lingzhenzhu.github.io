import { createContext, useContext } from 'react';
import assets from './assets.json';

export const AssetPreviewContext = createContext(false);
export function useAssetUrl() {
  const preview = useContext(AssetPreviewContext);
  return (src: string) =>
    !preview
      ? src
      : src.startsWith('/assets/uploads/')
        ? src.replace('/assets/uploads/', '/admin/api/assets/')
        : src.startsWith('/assets/')
          ? src.replace('/assets/', '/admin/assets/')
          : src;
}
export function responsiveImage(src: string, width: number, resolve: (src: string) => string) {
  const asset = (assets as Record<string, { width: number; height: number; srcset?: string }>)[src];
  return asset
    ? {
        width: asset.width,
        height: asset.height,
        ...(asset.srcset
          ? {
              srcSet: asset.srcset
                .split(', ')
                .map((variant) => {
                  const [url, size] = variant.split(' ');
                  return resolve(url) + ' ' + size;
                })
                .join(', '),
              sizes: '(max-width: ' + (width + 32) + 'px) calc(100vw - 32px), ' + width + 'px',
            }
          : {}),
      }
    : {};
}
