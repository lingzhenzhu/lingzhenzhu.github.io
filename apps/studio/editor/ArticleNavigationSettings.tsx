import { articleNavigation, articleNavigationActions } from '@lzzhu/content';
import type { CollectionProps } from './types';
import { FormSection } from './FormSection';
import { Select } from './Select';

export function ArticleNavigationSettings({ content, change }: Pick<CollectionProps, 'content' | 'change'>) {
  const links = articleNavigation(content.settings);
  const update = (index: number, patch: Partial<(typeof links)[number]>, remove = false) =>
    change((current) => {
      const next = [...articleNavigation(current.settings)];
      if (remove) next.splice(index, 1);
      else
        next[Math.min(index, next.length)] = {
          ...(next[index] ?? { action: 'all', align: 'left' }),
          ...patch,
        };
      return { ...current, settings: { ...current.settings, articleNavigation: next } };
    });
  return (
    <FormSection title="Article navigation" headingLevel={2}>
      <p className="field-help">
        Applies to all articles. Previous and Next appear only when another article is available.
      </p>
      {[0, 1].map((index) => (
        <div className="form-grid" key={index}>
          <label>
            Link {index + 1}
            <Select
              value={links[index]?.action || ''}
              onChange={(e) =>
                update(index, { action: e.target.value as (typeof links)[number]['action'] }, !e.target.value)
              }
            >
              <option value="">None</option>
              {Object.entries(articleNavigationActions)
                .filter(([action]) => !links.some((item, i) => i !== index && item.action === action))
                .map(([action, label]) => (
                  <option key={action} value={action}>
                    {label}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Link {index + 1} position
            <Select
              disabled={!links[index]}
              value={links[index]?.align || 'left'}
              onChange={(e) => update(index, { align: e.target.value as 'left' | 'right' })}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </Select>
          </label>
        </div>
      ))}
    </FormSection>
  );
}
