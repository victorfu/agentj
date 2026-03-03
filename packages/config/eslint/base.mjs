import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ['dist/**', '.next/**', 'node_modules/**'],
  languageOptions: {
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error'
  }
});
