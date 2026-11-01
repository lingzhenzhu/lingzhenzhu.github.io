import { Select } from './Select';
import { Switch } from './Switch';
import { Button } from './controls';
import { ArticleSettings } from './ArticleSettings';
import { FormSection } from './FormSection';
import type { Page } from '@lzzhu/content';
export function PageSettings({
  page,
  author,
  update,
  onDelete,
}: {
  page: Page;
  author: string;
  update: (patch: Partial<Page>) => void;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  const home = page.template === 'home';
  return (
    <>
      <h2>Page settings</h2>
      <FormSection title="Address & visibility">
        <label>
          Content language
          <Select
            value={page.language}
            onChange={(e) => update({ language: e.target.value as Page['language'] })}
          >
            <option value="en">English</option>
            <option value="zh-Hans">Chinese · Simplified</option>
            <option value="zh-Hant">Chinese · Traditional</option>
          </Select>
        </label>
        {(page.template === 'page' || page.template === 'archive') && (
          <label>
            Page type
            <Select
              value={page.template}
              onChange={(e) => update({ template: e.target.value as 'page' | 'archive' })}
            >
              <option value="page">Website page</option>
              <option value="archive">Archive page</option>
            </Select>
          </label>
        )}
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
          <Select
            value={page.status}
            disabled={home}
            onChange={(e) => update({ status: e.target.value as Page['status'] })}
          >
            <option value="draft">Draft</option>
            <option value="published">Public</option>
          </Select>
        </label>
        <label className="check">
          <Switch checked={page.showTitle} onChange={(e) => update({ showTitle: e.target.checked })} />
          Show page title
        </label>
      </FormSection>
      {page.template === 'article' && <ArticleSettings page={page} author={author} update={update} />}
      <FormSection title="Search & sharing">
        <label>
          Description
          <textarea value={page.description} onChange={(e) => update({ description: e.target.value })} />
        </label>
        <label className="check">
          <Switch checked={page.indexable} onChange={(e) => update({ indexable: e.target.checked })} />
          Allow search engines to index this page
        </label>
      </FormSection>
      <div className="danger-zone">
        <h3>Delete page</h3>
        <p>Remove this page from the draft and the next publication.</p>
        {page.blocks.some((block) => block.type === 'firebaseRewards') && (
          <p>Move the existing Firebase card to another page before deleting this page.</p>
        )}
        <Button
          compactIcons="keep"
          className="danger"
          disabled={home || page.blocks.some((block) => block.type === 'firebaseRewards')}
          onClick={(event) => onDelete(event.currentTarget)}
        >
          Delete page
        </Button>
      </div>
    </>
  );
}
