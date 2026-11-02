import katex, { type KatexOptions } from 'katex';
export const formulaOptions: KatexOptions = {
  trust: false,
  strict: 'error',
  throwOnError: true,
  maxSize: 20,
  maxExpand: 500,
  output: 'htmlAndMathml',
};
/** HTML comes only from the pinned renderer. Raw source/error messages are never injected. */
export function renderFormula(latex: string, displayMode = false) {
  if (!latex.trim()) return { error: 'Enter a formula.', html: '' };
  if (latex.length > 4000) return { error: 'Limit formulas to 4,000 characters.', html: '' };
  try {
    return { html: katex.renderToString(latex, { ...formulaOptions, displayMode }), error: '' };
  } catch {
    return { html: '', error: 'Check the LaTeX syntax. This formula cannot be displayed.' };
  }
}
