// Small, bounded cache shared by navigation lenses. Controls use CSS reflections.
const cache = new Map<string, string>();
export function displacementMap(width: number, height: number, radius: number) {
  const key = [width, height, radius].map(Math.round).join(':');
  if (cache.has(key)) return cache.get(key)!;
  const factor = Math.min(1, 480 / Math.max(width, height));
  const w = Math.max(2, Math.round(width * factor)),
    h = Math.max(2, Math.round(height * factor));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(w, h);
  const r = Math.min((radius || 24) * factor, w / 2, h / 2);
  const bezel = Math.min(r, Math.max(5, 12 * factor));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let dx = x - Math.max(r, Math.min(w - r, x));
      let dy = y - Math.max(r, Math.min(h - r, y));
      let distance: number;
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        distance = r - length;
        dx /= length;
        dy /= length;
      } else {
        const sides = [x, w - x, y, h - y];
        distance = Math.min(...sides);
        const side = sides.indexOf(distance);
        dx = side === 0 ? -1 : side === 1 ? 1 : 0;
        dy = side === 2 ? -1 : side === 3 ? 1 : 0;
      }
      const t = Math.max(0, Math.min(1, distance / bezel));
      const theta = Math.atan(Math.pow(1 - t, 2) * 2.8);
      const bend = Math.tan(theta - Math.asin(Math.sin(theta) / 1.45)) * Math.sin(Math.PI * t) * 0.55;
      // Written in place: an array per pixel was tens of thousands of allocations per map.
      const offset = (y * w + x) * 4;
      pixels.data[offset] = Math.round(128 + dx * bend * 127);
      pixels.data[offset + 1] = Math.round(128 + dy * bend * 127);
      pixels.data[offset + 2] = 128;
      pixels.data[offset + 3] = 255;
    }
  context.putImageData(pixels, 0, 0);
  const result = canvas.toDataURL();
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
