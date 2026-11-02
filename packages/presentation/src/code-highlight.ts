import { common, createLowlight } from 'lowlight';
export { codeLanguages, codeLanguageLabel } from './code-languages';
/** Full grammar set for server rendering. The editor loads the same grammars on demand. */
export const codeHighlighter = createLowlight(common);
codeHighlighter.register({ plaintext: () => ({ contains: [] }) });
