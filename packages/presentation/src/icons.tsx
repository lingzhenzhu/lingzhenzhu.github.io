import iconPaths from '../../../assets/source/icons.json';
export function Icon({
  name,
}: {
  name: keyof typeof iconPaths | 'link' | 'twitter' | 'instagram' | 'wechat';
}) {
  if (name === 'twitter' || name === 'instagram' || name === 'wechat')
    return (
      <svg
        className={'social-icon social-icon-custom social-' + name}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {name === 'twitter' && (
          <path
            fill="currentColor"
            stroke="none"
            d="M28 7.2c-1 .6-2 .9-3.2 1.1a5.2 5.2 0 0 0-9 3.5c0 .4 0 .8.1 1.2-4.3-.2-8-2.3-10.5-5.4-1.4 2.3-.7 5.4 1.7 6.9-.8 0-1.6-.3-2.3-.7 0 2.6 1.8 4.8 4.2 5.3-.8.2-1.6.3-2.4.1.7 2.1 2.6 3.6 4.8 3.7a10.6 10.6 0 0 1-7.7 2.1c2.3 1.5 5 2.3 7.8 2.3 9.4 0 14.5-7.8 14.5-14.5v-.7c1-.7 1.8-1.6 2.5-2.6-1 .4-2 .7-3 .8 1.1-.7 2-1.7 2.5-3.1Z"
            transform="translate(0 -1)"
          />
        )}
        {name === 'instagram' && (
          <>
            <rect x="5" y="5" width="22" height="22" rx="6" />
            <circle cx="16" cy="16" r="5.25" />
            <circle cx="23" cy="9" r=".9" fill="currentColor" stroke="none" />
          </>
        )}
        {name === 'wechat' && (
          // Solid like the other contact glyphs: the large bubble is cut by a gap
          // around the small one, and the eyes are holes (evenodd).
          <path
            fill="currentColor"
            stroke="none"
            fillRule="evenodd"
            d="M11.97 21.79A10.9 9.2 0 0 1 7.97 21L6 24.4l-1.17-5.18A10.9 9.2 0 1 1 23.22 11.46a10.2 8.8 0 0 0-11.25 10.33ZM7.15 9.9a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0Zm7.3 0a1.45 1.45 0 1 0 2.9 0 1.45 1.45 0 1 0-2.9 0Zm11.32 16.77A8.6 7.2 0 1 1 27.97 25.38l-.07 3.32ZM17.8 18.4a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0Zm6 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0Z"
          />
        )}
      </svg>
    );
  return (
    <svg className="social-icon" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
      {name === 'link' ? (
        <path d="M300 200h424v624H300z" />
      ) : (
        <path transform="translate(0 896) scale(1 -1)" d={iconPaths[name]} />
      )}
    </svg>
  );
}
