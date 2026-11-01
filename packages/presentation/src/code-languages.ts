/** Language names only, so pickers can list them without loading any grammar. Matches lowlight's `common`. */
export const codeLanguages = [
  'plaintext', 'arduino', 'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini',
  'java', 'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown', 'objectivec',
  'perl', 'php', 'php-template', 'python', 'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell',
  'sql', 'swift', 'typescript', 'vbnet', 'wasm', 'xml', 'yaml',
];
export function codeLanguageLabel(language: string) {
  return (
    (
      {
        plaintext: 'Plain text',
        javascript: 'JavaScript',
        typescript: 'TypeScript',
        cpp: 'C++',
        csharp: 'C#',
        objectivec: 'Objective-C',
        css: 'CSS',
        xml: 'HTML / XML',
        json: 'JSON',
        sql: 'SQL',
        php: 'PHP',
        yaml: 'YAML',
        ini: 'INI',
        bash: 'Shell',
        makefile: 'Makefile',
        graphql: 'GraphQL',
        wasm: 'WebAssembly',
      } as Record<string, string>
    )[language] || language[0]?.toUpperCase() + language.slice(1)
  );
}
