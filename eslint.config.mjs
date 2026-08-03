import { defineConfig, globalIgnores } from 'eslint/config';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import jasmine from 'eslint-plugin-jasmine';
import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import ngrx from '@ngrx/eslint-plugin/v9';
import importPlugin from 'eslint-plugin-import';
import rxjs from '@smarttools/eslint-plugin-rxjs';
import playwright from 'eslint-plugin-playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(
  globalIgnores([
    '**/environment.prod.ts',
    '**/playwright.config.ts',
    '**/playwright.base.config.ts',
  ]),

  // --- Arquivos JS ---
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // --- Arquivos TypeScript ---
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.eslint.json',
      },
    },
    extends: [
      eslint.configs.recommended,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
      sonarjs.configs.recommended,
      ...ngrx.configs.allTypeChecked,
      // `@smarttools/eslint-plugin-rxjs` é o fork MANTIDO do antigo
      // `eslint-plugin-rxjs` (cartant, último release em 03/2023, peer
      // `eslint: ^8`): já vem em flat config e usa `@typescript-eslint/utils@^8`,
      // a mesma major do `typescript-eslint` deste projeto — por isso as regras
      // tipadas funcionam sem workaround (Princípio XI).
      rxjs.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      tseslint.configs.eslintRecommended,
      ...angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.ts'] },
        typescript: {
          alwaysTryTypes: true,
          project: path.join(__dirname, './tsconfig.json'),
        },
      },
    },
    rules: {
      // Angular
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',

      // TypeScript
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'classProperty', format: ['camelCase'] },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_+(_*?)$',
          varsIgnorePattern: '^_+(_*?)$',
          caughtErrorsIgnorePattern: '^_+(_*?)$',
          ignoreRestSiblings: true,
          args: 'all',
        },
      ],
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/dot-notation': [
        'error',
        { allowIndexSignaturePropertyAccess: true },
      ],

      // Imports
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/extensions': ['error', 'ignorePackages', { ts: 'never' }],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/environments/*.ts',
            '**/*.spec.ts',
            '**/e2e/**/*.fixture.ts',
            '**/e2e/**/*.steps.ts',
            '**/e2e/**/*.helper.ts',
          ],
        },
      ],
      'import/prefer-default-export': 'off',

      // NgRx
      '@ngrx/avoid-mapping-selectors': 'off',
      '@ngrx/prefer-inline-action-props': 'off',
      '@ngrx/avoid-dispatching-multiple-actions-sequentially': 'off',
      '@ngrx/no-multiple-actions-in-effects': 'off',

      // Sonar
      'sonarjs/prefer-nullish-coalescing': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-empty-test-file': 'off',
      'sonarjs/no-angular-bypass-sanitization': 'off',
      'sonarjs/deprecation': 'off',
      'sonarjs/regex-complexity': 'off',

      // General
      'no-await-in-loop': 'error',
      'no-restricted-syntax': 'error',
      'no-console': ['error', { allow: ['error'] }],
      'no-nested-ternary': 'off',
      'no-use-before-define': ['error', { classes: false }],
      'no-useless-constructor': 'off',
      'max-classes-per-file': 'off',
      'class-methods-use-this': 'off',
      curly: ['error', 'all'],
      'dot-notation': 'off',
      'default-case': 'off',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', next: 'return', prev: '*' },
        { blankLine: 'always', next: '*', prev: ['const', 'let', 'var'] },
        {
          blankLine: 'any',
          next: ['const', 'let', 'var'],
          prev: ['const', 'let', 'var'],
        },
      ],
    },
  },

  // --- Arquivos de Teste ---
  {
    files: ['**/*.spec.ts'],
    plugins: { jasmine },
    languageOptions: {
      globals: { ...globals.jasmine },
    },
    extends: [jasmine.configs.recommended],
    rules: {
      'jasmine/named-spy': 2,
      'jasmine/no-assign-spyon': 2,
      'jasmine/prefer-toBeUndefined': 2,
      'jasmine/missing-expect': [
        2,
        'expectObservable()',
        'expect()',
        'expectAsync()',
      ],
      'jasmine/no-disabled-tests': 2,
      'jasmine/no-spec-dupes': [2, 'branch'],
      'jasmine/no-suite-dupes': [2, 'branch'],
      'jasmine/prefer-toHaveBeenCalledWith': 2,
      'sonarjs/no-nested-functions': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },

  // --- Arquivos E2E (Playwright + BDD) ---
  {
    files: ['**/*.fixture.ts', '**/*.steps.ts', '**/*.const.ts'],
    languageOptions: {
      parserOptions: { project: ['e2e/tsconfig.json'] },
    },
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-standalone-expect': 'off',
      'no-await-in-loop': 'off',
    },
  },

  // --- Templates HTML ---
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      // Acessibilidade é critério de aceite (Princípio X): `templateRecommended`
      // NÃO inclui as regras de a11y — elas vivem só em `templateAccessibility`.
      // Sem este bloco, campo sem nome acessível, clique sem handler de teclado e
      // `alt` ausente passam batido no lint.
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/attributes-order': 'error',
    },
  },
);
