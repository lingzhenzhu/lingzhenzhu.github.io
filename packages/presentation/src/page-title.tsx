import type { Page } from '@lzzhu/content';
import { responsiveImage, useAssetUrl } from './asset-context';

/** Shared title system: one compact banner and one optional-media opening. */
export function PageTitle({ page }: { page: Page }) {
  const assetUrl = useAssetUrl();
  if (!page.showTitle)
    return (
      <h1 className="post-title visually-empty-title">
        <span className="sr-only">{page.title}</span>
      </h1>
    );
  const home = page.template === 'home';
  const choice = home ? page.homeHero?.image : undefined;
  const image = choice?.source === 'profile' ? page.blocks.find((block) => block.type === 'profile') : choice;
  return (
    <header
      className={'page-title ' + (home ? 'home-opening' : 'page-banner') + (image ? ' has-portrait' : '')}
    >
      {!home && (
        <span className="title-backdrop" aria-hidden="true">
          <svg className="title-motif motif-left" viewBox="0 0 60 60" fill="none">
            <ellipse
              cx="30"
              cy="30"
              rx="24"
              ry="10"
              transform="rotate(-32 30 30)"
              stroke="currentColor"
              strokeWidth=".8"
            />
            <ellipse
              cx="30"
              cy="30"
              rx="24"
              ry="10"
              transform="rotate(48 30 30)"
              stroke="currentColor"
              strokeWidth=".8"
            />
            <circle cx="43" cy="19" r="2" fill="currentColor" />
          </svg>
          <svg className="title-motif motif-right" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="21" stroke="currentColor" strokeWidth=".7" />
            <path
              d="M30 5V20M30 40V55M5 30H20M40 30H55M15 15L23 23M37 37L45 45"
              stroke="currentColor"
              strokeWidth=".7"
            />
          </svg>
        </span>
      )}
      <div className="title-copy">
        <h1 className="title-english">{page.title}</h1>
        {home && page.homeHero?.nameNote && (
          <p className="name-note" lang="zh-Hans">
            {page.homeHero.nameNote}
          </p>
        )}
        {home && image && 'src' in image && (
          <figure className="opening-portrait">
            <img
              src={assetUrl(image.src)}
              {...responsiveImage(image.src, 420, assetUrl)}
              alt={image.alt}
              fetchPriority="high"
              decoding="async"
            />
          </figure>
        )}
      </div>
      {home && (
        <a className="explore-cue" href="#page-content">
          Explore more
          <span aria-hidden="true" />
        </a>
      )}
    </header>
  );
}
