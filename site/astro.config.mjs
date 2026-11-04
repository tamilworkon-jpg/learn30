import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
/* global process */

export default defineConfig({
  base: '/',
  // Per-checkout cache (default lives in node_modules, which parallel worktrees share via a junction).
  cacheDir: './.astro/cache',
  trailingSlash: 'ignore',
  integrations: [mdx(), preact()],
  // Shiki colours code with inline style attributes, which the strict CSP blocks; code blocks are styled in CSS instead.
  markdown: { syntaxHighlight: false },
  preview: { host: true, port: 4321, allowedHosts: ['localhost', '.devtunnels.ms', '.app.github.dev'] },
  experimental: {
    // Astro hashes its own inline scripts/styles into a <meta> CSP (Constitution VII).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  // Only localhost and VS Code forwarded-port domains may reach the dev/preview server (DNS-rebinding guard).
  server: { host: true, port: 4321, allowedHosts: ['localhost', '.devtunnels.ms', '.app.github.dev'] },
  vite: {
    plugins: [tailwindcss()],
    // Learn30 spec 002: test-only fixture courses (tests/fixtures/courses/) are built only for e2e runs.
    define: { __AIP_FIXTURE_COURSES__: JSON.stringify(process.env.AIP_FIXTURE_COURSES === '1') },
  },
});
