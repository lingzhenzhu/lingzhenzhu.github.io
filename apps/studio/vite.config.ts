import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // The writing editor's large libraries change far less often than Admin code. Separate
        // chunks keep them cached across releases and let the browser fetch them in parallel.
        codeSplitting: {
          groups: [
            // Claimed first, so the editor groups below never absorb what the whole Admin needs.
            {
              name: 'react',
              test: /node_modules[\\/](?:\.pnpm[\\/])?(?:react|react-dom|scheduler)[@\\/]/,
              priority: 20,
            },
            // The validated content model shared by every Admin view.
            { name: 'content-model', test: /node_modules[\\/].*[\\/]zod[\\/]|packages[\\/]content[\\/]/, priority: 15 },
            { name: 'formula', test: /node_modules[\\/](?:\.pnpm[\\/])?katex/ },
            // Only the grammars: the editor imports the small highlighter core and loads these on demand.
            {
              name: 'code-grammars',
              test: /node_modules[\\/].*(?:highlight\.js[\\/]lib[\\/]languages|lowlight[\\/]lib[\\/]common)/,
            },
            { name: 'editor-core', test: /node_modules[\\/].*(?:@tiptap|prosemirror|marked|linkifyjs)/ },
          ],
        },
      },
    },
  },
  server: { host: '127.0.0.1' },
});
