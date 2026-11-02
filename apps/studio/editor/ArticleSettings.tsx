import { Select } from './Select';
import { Switch } from './Switch';
import { useState } from 'react';
import { articleLicenses, selectedLicense, articleLicense, type Page } from '@lzzhu/content';
import { Button } from './controls';
import { FormSection } from './FormSection';

export function ArticleSettings({
  page,
  author,
  update,
}: {
  page: Page;
  author: string;
  update: (patch: Partial<Page>) => void;
}) {
  const details = page.articleDetails;
  const [tag, setTag] = useState('');
  const [tagError, setTagError] = useState('');
  const patch = (value: Partial<NonNullable<Page['articleDetails']>>) =>
    update({ articleDetails: { copyright: '', licenseLabel: '', ...details, ...value } });
  const tags = details?.tags || [];
  const addTag = () => {
    const value = tag.trim();
    if (!value) return;
    if (value.length > 60 || tags.length >= 30) {
      setTagError('Use up to 30 tags, each with 60 characters or fewer.');
      return;
    }
    if (!tags.includes(value)) patch({ tags: [...tags, value] });
    setTag('');
    setTagError('');
  };
  return (
    <>
      <FormSection title="Dates">
        <p className="field-help">Choose which dates appear above the article.</p>
        {(['published', 'updated'] as const).map((kind) => {
          const published = kind === 'published';
          const date = published ? page.date : details?.updatedDate;
          const time = published ? details?.time : details?.updatedTime;
          const display = published
            ? (details?.publishedDisplay ?? (details?.time ? 'datetime' : 'date'))
            : (details?.updatedDisplay ?? 'hidden');
          const name = published ? 'Published' : 'Updated';
          return (
            <div className="article-date-settings" key={kind}>
              <label>
                {name} display
                <Select value={display} onChange={(e) => patch({ [kind + 'Display']: e.target.value })}>
                  <option value="hidden">Hidden</option>
                  <option value="date">Date</option>
                  <option value="datetime">Date and time</option>
                </Select>
              </label>
              <div className="field-pair">
                <label>
                  {name} date
                  <input
                    type="date"
                    value={date || ''}
                    onChange={(e) =>
                      published
                        ? update({ date: e.target.value || undefined })
                        : patch({ updatedDate: e.target.value || undefined })
                    }
                  />
                </label>
                {display === 'datetime' && (
                  <label>
                    {name} time
                    <input
                      type="time"
                      value={time || ''}
                      onChange={(e) =>
                        patch({ [published ? 'time' : 'updatedTime']: e.target.value || undefined })
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </FormSection>
      <FormSection title="Author & license">
        <label>
          Author
          <input
            value={details?.author ?? ''}
            placeholder={author}
            onChange={(e) => patch({ author: e.target.value || undefined })}
          />
        </label>
        <p className="field-help">Leave empty to use {author}.</p>
        <label className="check">
          <Switch
            checked={
              details?.showLicense ?? Boolean(details?.licenseLabel || details?.copyright || details?.license)
            }
            onChange={(e) => patch({ showLicense: e.target.checked })}
          />
          Show license
        </label>
        <label>
          License
          <Select
            value={selectedLicense(details)}
            onChange={(e) =>
              patch({
                license: e.target.value as NonNullable<Page['articleDetails']>['license'],
                copyright: '',
                licenseLabel: '',
                licenseUrl: undefined,
              })
            }
          >
            {selectedLicense(details) === 'existing' && (
              <option value="existing">Current license · {articleLicense(details).label}</option>
            )}
            {Object.entries(articleLicenses).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </Select>
        </label>
        {articleLicense(details).url && (
          <p className="field-help">
            <a href={articleLicense(details).url} target="_blank" rel="noopener noreferrer">
              Read license terms
            </a>
          </p>
        )}
      </FormSection>
      <FormSection title="Tags">
        <div className="article-tag-editor">
          {tags.map((value) => (
            <Button
              key={value}
              type="button"
              aria-label={'Remove tag ' + value}
              onClick={() => patch({ tags: tags.filter((item) => item !== value) })}
            >
              {value}
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Button>
          ))}
        </div>
        <div className="article-tag-input">
          <label>
            New tag
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
          </label>
          <Button type="button" onClick={addTag} disabled={!tag.trim()}>
            Add tag
          </Button>
        </div>
        {tagError && <p role="alert">{tagError}</p>}
      </FormSection>
    </>
  );
}
