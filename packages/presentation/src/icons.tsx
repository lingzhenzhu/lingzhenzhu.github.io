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
          <>
            <path d="M18.5 20.2c-1.7 1-3.7 1.5-5.9 1.3l-4.4 2 .8-3.7C2 15.7 4.6 7 12.8 7c5.5 0 9.2 3.4 8.7 7.2" />
            <path d="M28.8 20.9c0-3.8-3.5-6.8-7.8-6.8s-7.8 3-7.8 6.8 3.5 6.8 7.8 6.8c1 0 2-.2 2.8-.4l3.5 1.5-.6-3.1c1.3-1.2 2.1-2.9 2.1-4.8Z" />
            <g fill="currentColor" stroke="none">
              <circle cx="9.5" cy="12.9" r="1" />
              <circle cx="16.3" cy="12.9" r="1" />
              <circle cx="18.1" cy="19.8" r=".9" />
              <circle cx="24" cy="19.8" r=".9" />
            </g>
          </>
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
