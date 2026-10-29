import { Button } from './controls';
import { useRecordSelection } from './useRecordSelection';
import { useRef, useState } from 'react';
import type { Block } from '@lzzhu/content';
import { reorder } from '../../../packages/content/src/operations';
import { ImageField, type ImageTools } from './ImageField';
import { SortableList } from './SortableList';
import { Dialog, EmptyState, Icon } from './ui';
type Teaching = Extract<Block, { type: 'teaching' }>;
export function TeachingFields({
  block,
  update,
  ...tools
}: ImageTools & { block: Teaching; update: (patch: Partial<Teaching>) => void }) {
  const { selected, select, rowRef, fallback } = useRecordSelection();
  const [removing, remove] = useState('');
  const trigger = useRef<HTMLElement | null>(null);
  const course = block.courses.find((item) => item.id === selected);
  const edit = (patch: Partial<Teaching['courses'][number]>) =>
    update({ courses: block.courses.map((item) => (item.id === selected ? { ...item, ...patch } : item)) });
  return (
    <>
      <label>
        Institution name
        <input value={block.institution} onChange={(e) => update({ institution: e.target.value })} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={block.showName}
          onChange={(e) => update({ showName: e.target.checked })}
        />
        Show institution name
      </label>
      <ImageField
        {...tools}
        logo
        src={block.logo}
        alt={block.institution}
        onChange={(patch) => update({ logo: patch.src || undefined })}
      />
      <div className="section-heading">
        <h3>Courses</h3>
        <Button
          ref={fallback}
          onClick={() => {
            const id = crypto.randomUUID();
            update({
              courses: [
                ...block.courses,
                {
                  id,
                  year: new Date().getFullYear(),
                  term: 'Fall',
                  code: '',
                  title: 'Untitled course',
                  position: '',
                },
              ],
            });
            select(id);
          }}
        >
          <Icon name="add" /> Add course
        </Button>
      </div>
      <SortableList
        items={block.courses}
        label="Course order"
        name={(item) => item.code || item.title}
        onMove={(id, to) => update({ courses: reorder(block.courses, id, to) })}
      >
        {(item, index, handle) => (
          <div className="item-row record-row">
            {handle}
            <Button
              compactIcons="keep"
              ref={rowRef(item.id)}
              className="row-link"
              aria-expanded={selected === item.id}
              onClick={() => select(selected === item.id ? '' : item.id)}
            >
              <span>
                <strong>
                  {item.code} {item.title}
                </strong>
                <small>
                  {item.year} {item.term} · {item.position || 'Position not set'}
                </small>
              </span>
            </Button>
            <Button
              compactIcons="keep"
              aria-label={'Move course up: ' + item.title}
              disabled={!index}
              onClick={() => update({ courses: reorder(block.courses, item.id, index - 1) })}
            >
              ↑
            </Button>
          </div>
        )}
      </SortableList>
      {!block.courses.length && <EmptyState title="No courses yet" />}
      {course && (
        <fieldset className="record-detail">
          <legend>Edit course</legend>
          <div className="field-pair">
            <label>
              Year
              <select value={course.year} onChange={(e) => edit({ year: Number(e.target.value) })}>
                {Array.from(
                  new Set([
                    course.year,
                    ...Array.from({ length: 51 }, (_, i) => new Date().getFullYear() + 5 - i),
                  ]),
                )
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <option key={year}>{year}</option>
                  ))}
              </select>
            </label>
            <label>
              Term
              <select
                value={course.term}
                onChange={(e) => edit({ term: e.target.value as typeof course.term })}
              >
                {['Spring', 'Summer', 'Fall', 'Winter', 'Full year'].map((term) => (
                  <option key={term}>{term}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Course code
            <input value={course.code} onChange={(e) => edit({ code: e.target.value })} />
          </label>
          <label>
            Course name
            <input value={course.title} onChange={(e) => edit({ title: e.target.value })} />
          </label>
          <label>
            Position
            <input value={course.position} onChange={(e) => edit({ position: e.target.value })} />
          </label>
          <label>
            Official resource link
            <input
              type="url"
              placeholder="https://github.com/…"
              value={course.resourceUrl || ''}
              onChange={(e) => edit({ resourceUrl: e.target.value || undefined })}
            />
          </label>
          <Button
            className="danger"
            onClick={(e) => {
              trigger.current = e.currentTarget;
              remove(course.id);
            }}
          >
            <Icon name="trash" /> Delete course
          </Button>
          <Button onClick={() => select('')}>
            <Icon name="check" /> Done
          </Button>
        </fieldset>
      )}
      {removing && (
        <Dialog title="Delete this course?" returnFocusTo={trigger.current} onClose={() => remove('')}>
          <p>You can undo this change.</p>
          <div className="dialog-actions">
            <Button compactIcons="keep" data-dialog-focus onClick={() => remove('')}>
              Cancel
            </Button>
            <Button
              className="danger"
              onClick={() => {
                update({ courses: block.courses.filter((item) => item.id !== removing) });
                select('');
                remove('');
              }}
            >
              <Icon name="trash" /> Delete course
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
