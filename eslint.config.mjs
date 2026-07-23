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
import rxjs from 'eslint-plugin-rxjs';
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
      // `rxjs.configs.recommended` ainda vem no formato eslintrc antigo
      // (`plugins: ['rxjs']`, array de string), incompatível com flat
      // config do ESLint 9 — usar só as regras, e registrar o plugin
      // propriamente no bloco `plugins` abaixo.
      { rules: rxjs.configs.recommended.rules },
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      tseslint.configs.eslintRecommended,
      ...angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: {
      'simple-import-sort': simpleImportSort,
      rxjs,
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
      // rxjs — as regras abaixo exigem parserServices tipado
      // (`getTypeServices`/`getParserServices`), mas `eslint-plugin-rxjs@5.0.3`
      // usa uma versão interna de `@typescript-eslint/utils` incompatível com
      // a versão de `typescript-eslint` deste projeto, e falham com "You must
      // therefore provide a value for the parserOptions.project property"
      // mesmo com o project corretamente configurado. Desativadas até a
      // dependência ser atualizada — as outras regras rxjs (que não exigem
      // tipo) continuam ativas via `rxjs.configs.recommended` acima.
      'rxjs/no-async-subscribe': 'off',
      'rxjs/no-create': 'off',
      'rxjs/no-ignored-notifier': 'off',
      'rxjs/no-implicit-any-catch': 'off',
      'rxjs/no-nested-subscribe': 'off',
      'rxjs/no-redundant-notify': 'off',
      'rxjs/no-subject-unsubscribe': 'off',
      'rxjs/no-unbound-methods': 'off',
      'rxjs/no-unsafe-subject-next': 'off',
      'rxjs/no-unsafe-takeuntil': 'off',

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
    extends: [...angular.configs.templateRecommended],
    rules: {
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/attributes-order': 'error',
    },
  },
);
