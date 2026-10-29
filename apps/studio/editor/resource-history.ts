import type { HistoryEntry, ResourceValue } from '@lzzhu/content/resources';
const sizes = new WeakMap<object, number>();
export const HISTORY_BYTES = 8_000_000;
export function historyBytes(entries: HistoryEntry[]) {
  const retained = new Set<ResourceValue>();
  let total = 0;
  for (const entry of entries)
    for (const change of [...entry.before, ...entry.after]) {
      if (change.value === null || retained.has(change.value)) continue;
      retained.add(change.value);
      let bytes = sizes.get(change.value);
      if (bytes === undefined) {
        bytes = new TextEncoder().encode(JSON.stringify(change.value)).byteLength;
        sizes.set(change.value, bytes);
      }
      total += bytes;
    }
  return total;
}
/** Keep at most 50 changes and 8 MB of resource data; a single whole-workspace restore remains undoable. */
export function trimHistory(entries: HistoryEntry[]) {
  while (entries.length > 50) entries.shift();
  while (entries.length > 1 && historyBytes(entries) > HISTORY_BYTES) entries.shift();
}
