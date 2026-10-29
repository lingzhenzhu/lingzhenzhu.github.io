import { requestCardCopy as copy } from './request-card-copy';

/** The original card owns its controls and presentation; authentication stays on the server. */
export function FirebaseCardAdmin({ preview }: { preview: boolean }) {
  return (
    <>
      <form className="rewards-login" data-card-password>
        <label htmlFor="firebase-password">{copy.passwordLabel}</label>{' '}
        <input
          id="firebase-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          disabled={preview}
        />{' '}
        <button type="submit" data-card-login disabled={preview}>
          {copy.login}
        </button>
        <p role="status" data-card-login-status />
      </form>
      <div className="rewards-admin" data-card-admin hidden>
        <h2 data-heading-level="3" className="rewards-heading">
          {copy.adminHeading}
        </h2>
        <div className="rewards-admin-actions">
          <button type="button" data-card-action="increase">
            {copy.increase}
          </button>{' '}
          <button type="button" data-card-action="decrease">
            {copy.decrease}
          </button>{' '}
          <button type="button" data-card-action="reset">
            {copy.reset}
          </button>{' '}
          <button type="button" data-card-clear>
            {copy.clear}
          </button>{' '}
          <button type="button" data-card-logout>
            {copy.logout}
          </button>
        </div>
        <p role="status" data-card-admin-status />
      </div>
      <dialog className="rewards-dialog" data-card-clear-dialog aria-labelledby="firebase-clear-title">
        <h2 data-heading-level="3" className="rewards-heading" id="firebase-clear-title">
          {copy.clearTitle}
        </h2>
        <p>{copy.clearDescription}</p>
        <div className="rewards-admin-actions">
          <button type="button" data-card-cancel>
            {copy.cancel}
          </button>{' '}
          <button type="button" data-card-confirm-clear>
            {copy.confirmClear}
          </button>
        </div>
        <p role="status" data-card-clear-status />
      </dialog>
    </>
  );
}
