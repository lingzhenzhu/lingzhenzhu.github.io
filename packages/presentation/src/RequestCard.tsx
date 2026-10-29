import type { Block } from '@lzzhu/content';
import { requestCardCopy } from './request-card-copy';
import { FirebaseCardAdmin } from './FirebaseCardAdmin';

export function RequestCard({
  block,
  preview = false,
}: {
  block: Extract<Block, { type: 'rewards' | 'firebaseRewards' }>;
  preview?: boolean;
}) {
  const firebase = block.type === 'firebaseRewards';
  if (firebase && block.hidden) return null;
  const labels = firebase ? requestCardCopy : block;
  return (
    <section
      className="rewards"
      aria-label={labels.title}
      data-rewards
      data-provider={firebase ? 'firebase' : 'cloudflare'}
      data-preview={String(preview)}
    >
      <p>
        剩余次数：<span data-rewards-balance>–</span> 次
      </p>
      <p>{labels.issuer}</p>
      <p>{labels.recipient}</p>
      <div className="rewards-box">
        <h2 data-heading-level="3" className="rewards-heading">
          {requestCardCopy.submitHeading}
        </h2>
        <form data-rewards-form>
          <label htmlFor={'request-' + block.id}>{labels.prompt}</label>
          <br />
          <input id={'request-' + block.id} name="request" required maxLength={500} />
          <br />
          <button type="submit" disabled={preview}>
            {labels.submitLabel}
          </button>
          <p role="status" data-rewards-status hidden />
        </form>
      </div>
      <div className="rewards-box">
        <h2 data-heading-level="3" className="rewards-heading">
          {requestCardCopy.historyHeading}
        </h2>
        <ul data-rewards-history />
      </div>
      {firebase ? (
        <FirebaseCardAdmin preview={preview} />
      ) : (
        <div className="rewards-login">
          管理员：<a href="/admin/#rewards">登录</a>
        </div>
      )}
    </section>
  );
}
