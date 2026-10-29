import { Button } from './controls';
import type { Page } from '@lzzhu/content';
export function PageSettings({
  page,
  update,
  onDelete,
}: {
  page: Page;
  update: (patch: Partial<Page>) => void;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  const home = page.template === 'home';
  return (
    <>
      <h2>Page settings</h2>
      <fieldset>
        <legend>Address & visibility</legend>
        <label>
          Content language
          <select
            value={page.language}
            onChange={(e) => update({ language: e.target.value as Page['language'] })}
          >
            <option value="en">English</option>
            <option value="zh-Hans">Chinese · Simplified</option>
            <option value="zh-Hant">Chinese · Traditional</option>
          </select>
        </label>
        <label>
          Page address
          <input
            value={page.path}
            disabled={page.path === '/' || page.blocks.some((block) => block.type === 'rewards')}
            onChange={(e) => update({ path: e.target.value })}
          />
        </label>
        <label>
          Visibility
          <select
            value={page.status}
            disabled={home}
            onChange={(e) => update({ status: e.target.value as Page['status'] })}
          >
            <option value="draft">Draft · excluded from publication</option>
            <option value="published">Public · include when publishing</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={page.showTitle}
            onChange={(e) => update({ showTitle: e.target.checked })}
          />
          Show page title
        </label>
        {page.template === 'article' && (
          <label>
            Article date
            <input
              type="date"
              value={page.date || ''}
              onChange={(e) => update({ date: e.target.value || undefined })}
            />
          </label>
        )}
      </fieldset>
      {page.template === 'article' && (
        <fieldset>
          <legend>Article details</legend>
          <label>
            Publication time (optional)
            <input
              type="time"
              value={page.articleDetails?.time || ''}
              onChange={(e) =>
                update({
                  articleDetails: {
                    copyright: '',
                    licenseLabel: '',
                    ...page.articleDetails,
                    time: e.target.value || undefined,
                  },
                })
              }
            />
          </label>
          <label>
            Copyright statement
            <input
              value={page.articleDetails?.copyright || ''}
              onChange={(e) =>
                update({
                  articleDetails: { licenseLabel: '', ...page.articleDetails, copyright: e.target.value },
                })
              }
            />
          </label>
          <label>
            License name
            <input
              value={page.articleDetails?.licenseLabel || ''}
              onChange={(e) =>
                update({
                  articleDetails: { copyright: '', ...page.articleDetails, licenseLabel: e.target.value },
                })
              }
            />
          </label>
          <label>
            License address
            <input
              value={page.articleDetails?.licenseUrl || ''}
              onChange={(e) =>
                update({
                  articleDetails: {
                    copyright: '',
                    licenseLabel: '',
                    ...page.articleDetails,
                    licenseUrl: e.target.value || undefined,
                  },
                })
              }
            />
          </label>
        </fieldset>
      )}
      <fieldset>
        <legend>Search & sharing</legend>
        <label>
          Description
          <textarea value={page.description} onChange={(e) => update({ description: e.target.value })} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={page.indexable}
            onChange={(e) => update({ indexable: e.target.checked })}
          />
          Allow search engines to index this page
        </label>
      </fieldset>
      <div className="danger-zone">
        <h3>Delete page</h3>
        <p>Remove this page from your draft and the next publication.</p>
        <Button
          compactIcons="keep"
          className="danger"
          disabled={home}
          onClick={(event) => onDelete(event.currentTarget)}
        >
          Delete page
        </Button>
      </div>
    </>
  );
}
