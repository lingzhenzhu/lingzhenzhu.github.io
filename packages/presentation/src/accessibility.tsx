export function Accessibility() {
  return (
    <div id="a11y-panel" className="a11y-panel" role="complementary" aria-label="Accessibility options">
      <button
        id="a11y-btn"
        className="a11y-btn"
        aria-label="Accessibility options"
        aria-expanded="false"
        aria-controls="a11y-menu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M12 7c-2.76 0-5 2.24-5 5h2c0-1.65 1.35-3 3-3s3 1.35 3 3h2c0-2.76-2.24-5-5-5z" />
          <path d="M7.58 11.58L6 13l3 3v5h2v-4h2v4h2v-5l3-3-1.58-1.42C15.37 12.45 13.74 13 12 13s-3.37-.55-4.42-1.42z" />
        </svg>
      </button>
      <div id="a11y-menu" className="a11y-menu" role="group" aria-label="Accessibility" aria-hidden="true">
        <div className="a11y-menu-title">Accessibility</div>
        <button className="a11y-option" id="toggle-dark" aria-pressed="false">
          <span className="a11y-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
            </svg>
          </span>
          <span>Dark Mode</span>
        </button>
        <button className="a11y-option" id="toggle-font-size" aria-pressed="false">
          <span className="a11y-icon" aria-hidden="true">
            A↑
          </span>
          <span>Larger Text</span>
        </button>
        <button className="a11y-option" id="toggle-contrast" aria-pressed="false">
          <span className="a11y-icon" aria-hidden="true">
            ◑
          </span>
          <span>High Contrast</span>
        </button>
        <button className="a11y-option" id="toggle-read-aloud" aria-pressed="false">
          <span className="a11y-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
          </span>
          <span>Read Aloud</span>
        </button>
        <button className="a11y-option" id="reset-a11y">
          <span className="a11y-icon" aria-hidden="true">
            ↺
          </span>
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}
