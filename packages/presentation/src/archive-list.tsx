import { Fragment } from 'react';
import { archiveRows, type ArchiveEntry } from './archive-rows';
import { displayDate } from './date';

export function ArchiveItems({ entries }: { entries: ArchiveEntry[] }) {
  return archiveRows(entries).map(({ entry, heading }) => (
    <Fragment key={entry.id}>
      {heading && (
        <h2 className="archive-year" data-heading-level="3">
          {heading}
        </h2>
      )}
      <article className="archive-item">
        <a className="archive-item-link" href={entry.path}>
          {entry.title}
        </a>
        {entry.date && (
          <time className="archive-item-date" dateTime={entry.date}>
            {displayDate(entry.date)}
          </time>
        )}
      </article>
    </Fragment>
  ));
}
