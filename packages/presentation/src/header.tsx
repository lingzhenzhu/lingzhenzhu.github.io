import { navigation, type Content, type Page } from '@lzzhu/content';
import { useAssetUrl } from './asset-context';
import type { CSSProperties } from 'react';
export function Header({ content, page }: { content: Content; page: Page }) {
  const assetUrl = useAssetUrl();
  const links = navigation(content).map((item, index) => (
    <a
      key={item.id}
      className="menu-item"
      href={item.path}
      aria-current={item.path === page.path ? 'page' : undefined}
      style={{ '--navigation-index': index } as CSSProperties}
    >
      {item.navLabel}
    </a>
  ));
  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <div className="container">
          <div className="navbar-header header-logo">
            <a href="/" aria-label={content.settings.author + ' home'}>
              <img
                src={assetUrl(content.settings.logo)}
                alt={content.settings.author}
                className="site-logo"
                width="50"
                height="38"
              />
            </a>
          </div>
          <div className="menu navbar-right">{links}</div>
        </div>
      </nav>
      <nav className="navbar-mobile" aria-label="Mobile navigation">
        <div className="container">
          <div className="navbar-header">
            <a href="/" aria-label={content.settings.author + ' home'}>
              <img
                src={assetUrl(content.settings.logo)}
                alt={content.settings.author}
                className="site-logo"
                width="44"
                height="34"
              />
            </a>
            <button
              type="button"
              className="menu-toggle"
              aria-label="Menu"
              aria-expanded="false"
              aria-controls="mobile-menu"
            >
              <span className="menu-toggle-label" aria-hidden="true">
                <svg
                  className="menu-toggle-bars"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  focusable="false"
                >
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
                Menu
              </span>
              <svg
                className="menu-toggle-close"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="menu" id="mobile-menu" inert>
            {links}
          </div>
        </div>
      </nav>
    </header>
  );
}
