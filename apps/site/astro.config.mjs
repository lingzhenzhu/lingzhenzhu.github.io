import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
export default defineConfig({
  site: 'https://www.lzzhu.net',
  output: 'static',
  // Reuse cached font styles across pages instead of repeating them in every HTML document.
  build: { inlineStylesheets: 'never' },
  trailingSlash: 'always',
  integrations: [react()],
  markdown: { syntaxHighlight: 'prism' },
  security: {
    csp: {
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      directives: [
        "base-uri 'none'",
        "object-src 'none'",
        "form-action 'self'",
        'frame-src https://embed.podcasts.apple.com',
      ],
    },
  },
  vite: {
    ssr: { noExternal: ['@astrojs/react', '@lzzhu/content', '@lzzhu/presentation'] },
    server: { fs: { allow: ['../..'] } },
  },
});
