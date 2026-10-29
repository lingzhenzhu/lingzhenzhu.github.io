import { navigation, type Content, type Page } from '@lzzhu/content';
import { useAssetUrl } from './asset-context';
export function Header({ content, page }: { content: Content; page: Page }) {
  const assetUrl = useAssetUrl();
  const links = navigation(content).map((item) => (
    <a
      key={item.id}
      className="menu-item"
      href={item.path}
      aria-current={item.path === page.path ? 'page' : undefined}
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
            <a href="/">
              <img
                src={assetUrl(content.settings.logo)}
                alt={content.settings.author}
                className="site-logo"
                width="44"
                height="34"
              />
            </a>
            <button className="menu-toggle" aria-expanded="false" aria-controls="mobile-menu">
              ☰ Menu
            </button>
          </div>
          <div className="menu" id="mobile-menu">
            {links}
          </div>
        </div>
      </nav>
    </header>
  );
}
