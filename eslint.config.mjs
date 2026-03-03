import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '.turbo/**'],
  languageOptions: {
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'off'
  }
});
