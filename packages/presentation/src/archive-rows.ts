export interface ArchiveEntry {
  id: string;
  path: string;
  title: string;
  date?: string;
}

/** Both the static archive and filtered results use the same year breaks. */
export function archiveRows<T extends ArchiveEntry>(entries: T[]) {
  let previousYear = '';
  return entries.map((entry) => {
    const year = entry.date?.slice(0, 4) || 'Undated';
    const heading = year !== previousYear ? year : undefined;
    previousYear = year;
    return { entry, heading };
  });
}
