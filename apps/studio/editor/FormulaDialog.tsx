import { Select } from './Select';
import { useId, useState } from 'react';
import { Dialog } from './ui';
import { Button } from './controls';
import { renderFormula } from '@lzzhu/presentation/formula';
export interface FormulaDraft {
  latex: string;
  block: boolean;
  pos?: number;
}
export function FormulaDialog({
  value,
  onApply,
  onClose,
  trigger,
}: {
  value: FormulaDraft;
  onApply: (value: FormulaDraft) => void;
  onClose: () => void;
  trigger: HTMLElement | null;
}) {
  const [draft, setDraft] = useState(value);
  const result = renderFormula(draft.latex, draft.block);
  const hint = useId();
  return (
    <Dialog
      title={value.pos === undefined ? 'Insert formula' : 'Edit formula'}
      onClose={onClose}
      returnFocusTo={trigger}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!result.error) onApply(draft);
        }}
      >
        <label>
          Layout
          <Select
            value={draft.block ? 'block' : 'inline'}
            disabled={value.pos !== undefined}
            onChange={(e) => setDraft({ ...draft, block: e.target.value === 'block' })}
          >
            <option value="inline">In line with text</option>
            <option value="block">Separate line</option>
          </Select>
        </label>
        <label htmlFor={hint + '-source'}>LaTeX</label>
        <textarea
          id={hint + '-source'}
          className="formula-input"
          value={draft.latex}
          maxLength={4000}
          aria-describedby={hint}
          data-dialog-focus
          spellCheck={false}
          onChange={(e) => setDraft({ ...draft, latex: e.target.value })}
        />
        <p className="field-help" id={hint}>
          For example: x^2 + y^2 = r^2. In Markdown, use $…$ or $$…$$.
        </p>
        <div className="formula-preview" aria-label="Formula preview">
          {result.error ? (
            <p role="status">{result.error}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: result.html }} />
          )}
        </div>
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="primary" type="submit" disabled={!!result.error}>
            {value.pos === undefined ? 'Insert formula' : 'Apply'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
