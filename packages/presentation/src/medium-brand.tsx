import { useAssetUrl } from './asset-context';

/** Official wordmark paired with the symbol from the original site design. */
export function MediumBrand() {
  const assetUrl = useAssetUrl();
  return (
    <span className="medium-wordmark">
      <svg
        className="medium-logo"
        viewBox="0 0 80 32"
        width="60"
        height="24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse cx="16" cy="16" rx="16" ry="16" />
        <ellipse cx="53" cy="16" rx="10" ry="16" />
        <ellipse cx="76" cy="16" rx="4" ry="16" />
      </svg>
      <img
        className="wordmark-light"
        src={assetUrl('/assets/medium-wordmark-black.svg')}
        alt="Medium"
        width="115"
        height="25.3"
      />
      <img
        className="wordmark-dark"
        src={assetUrl('/assets/medium-wordmark-white.svg')}
        alt="Medium"
        width="115"
        height="25.3"
      />
    </span>
  );
}
