/** Reject incomplete containers before spending decoder resources. Pixel decoding follows. */
export function completeImageContainer(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let index = bytes.length - 2; index > 2; index--)
      if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return true;
    return false;
  }
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF')
    return (
      bytes.length >= 20 &&
      view.getUint32(4, true) === bytes.length - 8 &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  if (bytes.slice(0, 8).join(',') !== '137,80,78,71,13,10,26,10') return false;
  let offset = 8,
    imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      end = offset + 12 + length;
    if (end > bytes.length) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) return false;
    let crc = 0xffffffff;
    for (let index = offset + 4; index < end - 4; index++)
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 255];
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end - 4)) return false;
    if (type === 'IDAT') imageData = true;
    if (type === 'IEND') return length === 0 && imageData && end === bytes.length;
    offset = end;
  }
  return false;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
