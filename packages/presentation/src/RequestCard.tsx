import type { Block } from '@lzzhu/content';

const firebaseCardLabels = {
  title: '任意要求卡',
  issuer: '签发人：朱苓榛老公',
  recipient: '授予人：杜沐老婆',
  prompt: '尊敬的老婆大人，请输入你的具体要求：',
  submitLabel: '提交申请',
};

export function RequestCard({
  block,
  preview = false,
}: {
  block: Extract<Block, { type: 'rewards' | 'firebaseRewards' }>;
  preview?: boolean;
}) {
  const firebase = block.type === 'firebaseRewards';
  if (firebase && block.hidden) return null;
  const labels = firebase ? firebaseCardLabels : block;
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
          提交请求
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
          申请记录
        </h2>
        <ul data-rewards-history />
      </div>
      <div className="rewards-login">
        管理员：
        {firebase ? (
          <button type="button" data-card-login disabled={preview}>
            登录
          </button>
        ) : (
          <a href="/admin/#rewards">登录</a>
        )}
      </div>
      {firebase && (
        <>
          <div className="rewards-box" data-card-admin hidden>
            <h2 className="rewards-heading">管理员</h2>
            <form data-card-balance>
              <label htmlFor="firebase-balance">设置剩余次数</label>
              <br />
              <input
                id="firebase-balance"
                name="remaining"
                type="number"
                min="0"
                max="100000"
                step="1"
                required
              />
              <br />
              <button type="submit">保存次数</button>
            </form>
            <button type="button" data-card-clear>
              清空记录
            </button>{' '}
            <button type="button" data-card-logout>
              退出登录
            </button>
            <p role="status" data-card-admin-status />
          </div>
          <dialog className="rewards-dialog" data-card-password-dialog aria-labelledby="firebase-login-title">
            <h2 id="firebase-login-title">管理员登录</h2>
            <form data-card-password>
              <label htmlFor="firebase-password">管理员密码</label>
              <br />
              <input
                id="firebase-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
              />
              <br />
              <p role="status" data-card-login-status />
              <button type="button" data-card-cancel>
                取消
              </button>{' '}
              <button type="submit">登录</button>
            </form>
          </dialog>
          <dialog className="rewards-dialog" data-card-clear-dialog aria-labelledby="firebase-clear-title">
            <h2 id="firebase-clear-title">清空申请记录？</h2>
            <p>所有申请记录将被删除，剩余次数保持不变。</p>
            <button type="button" data-card-cancel>
              取消
            </button>{' '}
            <button type="button" data-card-confirm-clear>
              清空记录
            </button>
            <p role="status" data-card-clear-status />
          </dialog>
        </>
      )}
    </section>
  );
}
