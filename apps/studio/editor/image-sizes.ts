import { builtImageSize } from '@lzzhu/presentation/asset-context';
import { api } from './api';
import type { Asset } from './types';

/**
 * Intrinsic image sizes, so the editor reserves an image's space before it loads instead of
 * pushing the text below it down. Built-in assets come from the build manifest; uploads come from
 * the asset list or their upload response.
 */
export type ImageSize = { width: number; height: number };
const uploads = new Map<string, ImageSize>();
let listed: Promise<void> | undefined;

export function rememberImageSizes(assets: Pick<Asset, 'id' | 'width' | 'height'>[]) {
  for (const asset of assets)
    if (asset.width && asset.height)
      uploads.set('/assets/uploads/' + asset.id, { width: asset.width, height: asset.height });
}
export function knownImageSize(src: string): ImageSize | undefined {
  return builtImageSize(src) ?? uploads.get(src);
}
/** Resolves once the asset list has been read (at most once per session). */
export function imageSize(src: string): Promise<ImageSize | undefined> {
  const known = knownImageSize(src);
  if (known || !src.startsWith('/assets/uploads/')) return Promise.resolve(known);
  listed ??= api<Asset[]>('/assets').then(rememberImageSizes, () => {
    listed = undefined;
  });
  return listed.then(() => uploads.get(src));
}
