import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const noUnsafeHtml = {
  'no-restricted-properties': [
    'error',
    { property: 'innerHTML', message: 'Untrusted HTML injection is forbidden (Constitution VII).' },
    { property: 'outerHTML', message: 'Untrusted HTML injection is forbidden (Constitution VII).' },
  ],
};

export default tseslint.config(
  { ignores: ['dist/**', 'dist-e2e/**', 'dist-*/**', '.astro/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'tests/fixtures/**', 'src/schemas/generated/**', '**/*.astro'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      ...noUnsafeHtml,
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
);
