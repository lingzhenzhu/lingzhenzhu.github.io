import { type ReactNode } from 'react';
import { type Content, type Block, type ModuleAdapters } from '@lzzhu/content';
import { RichText } from './rich-text';
import { Icon } from './icons';
import { MediumBrand } from './medium-brand';
import { Teaching, Research, Gallery } from './editorial-blocks';
import { Archive } from './archive';
import { displayDate } from './date';
import { useAssetUrl, responsiveImage } from './asset-context';
type RenderContext = {
  content: Content;
  preview?: boolean;
  priorityImage?: boolean;
  assetUrl: ReturnType<typeof useAssetUrl>;
};
// This map must implement every neutral module contract. No editor code enters the public bundle.
export const blockRenderers = {
  teaching: ({ block }) => <Teaching block={block} />,
  research: ({ block, priorityImage }) => <Research block={block} priorityImage={priorityImage} />,
  gallery: ({ block, priorityImage }) => <Gallery block={block} priorityImage={priorityImage} />,
  richText: ({ block }) => <RichText node={block.document} />,
  profile: ({ block, assetUrl }) => (
    <div className="home-profile">
      <div className="avatar">
        <a href="/">
          <img
            src={assetUrl(block.src)}
            {...responsiveImage(block.src, 110, assetUrl)}
            alt={block.alt}
            width="110"
            height="110"
            fetchPriority="high"
            decoding="async"
          />
        </a>
      </div>
    </div>
  ),
  image: ({ block, assetUrl, priorityImage }) => (
    <div className={'content-image align-' + block.align} style={{ maxWidth: block.width }}>
      <img
        src={assetUrl(block.src)}
        {...responsiveImage(block.src, block.width, assetUrl)}
        alt={block.alt}
        loading={priorityImage ? 'eager' : 'lazy'}
        fetchPriority={priorityImage ? 'high' : undefined}
        decoding="async"
        style={{ borderRadius: block.rounded ? 10 : 0 }}
      />
    </div>
  ),
  contacts: ({ block, content }) => (
    <div className="contact-block">
      <p className="contact-title">{block.title}</p>
      <div className="links">
        {content.settings.contacts.map((contact) => (
          <a
            className="link-item"
            title={contact.label}
            aria-label={contact.label}
            target="_blank"
            rel="noopener noreferrer"
            href={contact.url}
            key={contact.url}
          >
            <Icon name={contact.icon} />
          </a>
        ))}
      </div>
    </div>
  ),
  news: ({ block, content }) => (
    <div
      className="news-component"
      data-news
      data-autoplay={String(block.autoplay)}
      data-interval={block.interval}
    >
      <h2 id={'news-' + block.id}>
        <button
          className="news-toggle"
          aria-label={block.title + ': pause automatic scrolling'}
          aria-pressed="false"
          aria-describedby={'news-hint-' + block.id}
        >
          <strong>{block.title}</strong>
        </button>
      </h2>
      <span className="news-hint" id={'news-hint-' + block.id}>
        Select News to pause or resume
      </span>
      <div className="news-feed" aria-label="News feed">
        <div className="news-feed-inner" tabIndex={0} role="region" aria-label="Scrollable news">
          <ul className="news-list">
            {content.news
              .filter((n) => n.published)
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((entry) => (
                <li className="news-item" key={entry.id}>
                  <span className="news-text">{entry.text}</span>
                  <time className="news-date" dateTime={entry.date}>
                    {entry.label}
                  </time>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  ),
  medium: ({ block, content, preview, assetUrl }) => (
    <section
      className="medium-section"
      aria-label={block.title}
      data-medium
      data-limit={block.limit}
      data-preview={String(preview)}
    >
      <h2>
        {block.title.toLowerCase() !== 'medium' && block.title}
        <MediumBrand />
      </h2>
      <div className="medium-list">
        {content.medium
          .filter((entry) => !entry.hidden)
          .slice(0, block.limit)
          .map((entry) => (
            <a
              className="medium-card"
              key={entry.id}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <h3>{entry.title}</h3>
                <time dateTime={entry.publishedAt}>{displayDate(entry.publishedAt)}</time>
                <span className="medium-read">Read on Medium ↗</span>
              </div>
              <img
                src={assetUrl(entry.coverOverride || entry.cover || '/assets/medium-fallback.svg')}
                data-medium-cover
                alt=""
                width="180"
                height="120"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </a>
          ))}
      </div>
      <p data-medium-empty hidden={content.medium.some((entry) => !entry.hidden)}>
        New writing will appear here. <a href="https://medium.com/@lzzhu718">Visit Medium ↗</a>
      </p>
    </section>
  ),
  archive: ({ block, content }) => <Archive block={block} content={content} />,
  podcast: ({ block }) => (
    <iframe
      className="podcast-frame"
      src={block.url}
      title={block.title}
      height="450"
      loading="lazy"
      credentialless=""
      sandbox="allow-scripts allow-same-origin allow-popups"
      allow="autoplay *; encrypted-media *; fullscreen *"
    />
  ),
  rewards: ({ block, preview }) => (
    <section className="rewards" aria-label={block.title} data-rewards data-preview={String(preview)}>
      <p>
        剩余次数：<span data-rewards-balance>–</span> 次
      </p>
      <p>{block.issuer}</p>
      <p>{block.recipient}</p>
      <div className="rewards-box">
        <h2 data-heading-level="3" className="rewards-heading">
          提交请求
        </h2>
        <form data-rewards-form>
          <label htmlFor={'request-' + block.id}>{block.prompt}</label>
          <br />
          <input id={'request-' + block.id} name="request" required maxLength={500} />
          <br />
          <button type="submit">{block.submitLabel}</button>
          <p role="status" data-rewards-status hidden />
        </form>
      </div>
      <div className="rewards-box">
        <h2 data-heading-level="3" className="rewards-heading">
          申请记录
        </h2>
        <ul data-rewards-history />
      </div>
      <div className="rewards-login">
        管理员：<a href="/admin/#rewards">登录</a>
      </div>
    </section>
  ),
} satisfies ModuleAdapters<RenderContext, ReactNode>;

export function RenderBlock({
  block,
  content,
  preview = false,
  priorityImage = false,
}: { block: Block } & Omit<RenderContext, 'assetUrl'>): ReactNode {
  const assetUrl = useAssetUrl();
  // The discriminant selects the matching adapter; the cast only bridges TS's union-index limitation.
  const render = blockRenderers[block.type] as (props: RenderContext & { block: Block }) => ReactNode;
  return render({ block, content, preview, priorityImage, assetUrl });
}
