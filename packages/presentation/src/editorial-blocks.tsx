import type { Block } from '@lzzhu/content';
import { createElement } from 'react';
import { useAssetUrl, responsiveImage } from './asset-context';
import { RichText } from './rich-text';

export function Teaching({ block }: { block: Extract<Block, { type: 'teaching' }> }) {
  const asset = useAssetUrl();
  return (
    <section className="teaching-institution" aria-label={block.institution}>
      {block.logo && (
        <div className="content-image align-left institution-logo">
          <img
            src={asset(block.logo)}
            {...responsiveImage(block.logo, 50, asset)}
            alt={block.institution}
            width="50"
            height="50"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      {block.showName && <h2>{block.institution}</h2>}
      {block.courses.map((course) => (
        <div className="teaching-course" key={course.id}>
          {createElement(
            block.showName ? 'h3' : 'h2',
            { id: course.headingId || 'course-' + course.id, 'data-heading-level': '3' },
            `${course.year} ${course.term}`,
          )}
          <p>
            <strong>
              {course.code}
              {course.code && course.title ? ': ' : ''}
              {course.title}
            </strong>
            <br />
            {course.position}
            {course.resourceUrl && (
              <>
                <br />
                <a
                  className="editorial-resource"
                  href={course.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Course resources ↗
                </a>
              </>
            )}
          </p>
        </div>
      ))}
    </section>
  );
}
export function Research({
  block,
  priorityImage = false,
}: {
  block: Extract<Block, { type: 'research' }>;
  priorityImage?: boolean;
}) {
  const asset = useAssetUrl();
  return (
    <section className="research-project" aria-label={block.title}>
      <p className="research-project-title">
        <em>{block.title}</em>
      </p>
      {block.parts.map((part) =>
        part.type === 'text' ? (
          <RichText key={part.id} node={part.document} />
        ) : (
          <div className="content-image align-center" key={part.id} style={{ maxWidth: part.width }}>
            <img
              src={asset(part.src)}
              {...responsiveImage(part.src, part.width, asset)}
              alt={part.alt}
              loading={
                priorityImage && part.id === block.parts.find((item) => item.type === 'image')?.id
                  ? 'eager'
                  : 'lazy'
              }
              fetchPriority={
                priorityImage && part.id === block.parts.find((item) => item.type === 'image')?.id
                  ? 'high'
                  : undefined
              }
              decoding="async"
              style={{ borderRadius: 10 }}
            />
          </div>
        ),
      )}
      {block.paperUrl && (
        <p>
          <a className="editorial-resource" href={block.paperUrl} target="_blank" rel="noopener noreferrer">
            {block.paperLabel || 'Read paper'} ↗
          </a>
        </p>
      )}
    </section>
  );
}
export function Gallery({
  block,
  priorityImage = false,
}: {
  block: Extract<Block, { type: 'gallery' }>;
  priorityImage?: boolean;
}) {
  const asset = useAssetUrl();
  if (!block.photos.length) return null;
  return (
    <section
      className="photo-gallery"
      aria-label={block.title || 'Photo gallery'}
      aria-roledescription="carousel"
      data-gallery
      data-autoplay={String(block.autoplay)}
      data-interval={block.interval}
    >
      {block.title && <h2>{block.title}</h2>}
      <div className="gallery-stage">
        {block.photos.map((photo, index) => (
          <figure
            key={photo.id}
            data-gallery-slide
            data-caption={photo.caption}
            role="group"
            aria-roledescription="slide"
            aria-label={index + 1 + ' of ' + block.photos.length}
          >
            <div className="gallery-artwork">
              <img
                src={asset(photo.src)}
                {...responsiveImage(photo.src, 760, asset)}
                alt={photo.alt}
                loading={priorityImage && index === 0 ? 'eager' : 'lazy'}
                fetchPriority={priorityImage && index === 0 ? 'high' : undefined}
                decoding="async"
              />
            </div>
          </figure>
        ))}
      </div>
      <div className="gallery-footer">
        <div className="gallery-description">
          <p data-gallery-caption>{block.photos[0].caption}</p>
          <span data-gallery-count aria-hidden="true">
            01 / {String(block.photos.length).padStart(2, '0')}
          </span>
        </div>
        <div className="gallery-controls" hidden>
          <button data-gallery-prev aria-label="Previous photo" title="Previous photo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 5-7 7 7 7" />
            </svg>
          </button>
          {block.autoplay && (
            <button
              data-gallery-pause
              aria-label="Pause slideshow"
              title="Pause slideshow"
              aria-pressed="false"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path className="gallery-pause-glyph" d="M9 5v14M15 5v14" />
                <path className="gallery-play-glyph" d="m9 5 10 7-10 7Z" />
              </svg>
            </button>
          )}
          <button data-gallery-next aria-label="Next photo" title="Next photo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m10 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="gallery-thumbnails" hidden>
        {block.photos.map((photo, index) => (
          <button
            key={photo.id}
            data-gallery-index={index}
            aria-label={'Show photo ' + (index + 1) + (photo.alt ? ': ' + photo.alt : '')}
            aria-pressed={index === 0}
          >
            <img
              src={asset(photo.src)}
              {...responsiveImage(photo.src, 62, asset)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>
      <span className="visually-hidden" data-gallery-status role="status" />
    </section>
  );
}
