/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
module.exports = {
  testRunner: 'karma',
  karma: {
    projectType: 'angular-cli',
    config: {
      browsers: ['ChromeHeadless'],
    },
    configFile: 'karma.conf.js',
    ngConfig: {
      testArguments: {
        project: 'terapia-nutricional-ui',
      },
    },
  },
  checkers: ['typescript'],
  plugins: [
    '@stryker-mutator/karma-runner',
    '@stryker-mutator/typescript-checker',
  ],
  tsconfigFile: 'tsconfig.app.json',
  htmlReporter: { fileName: 'dist/reports/stryker/index.html' },
  mutate: [
    'src/app/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.configuration.ts',
    '!src/app/app.routing.ts',
    '!src/**/translation-configuration.ts',
  ],
  timeoutMS: 30000,
  reporters: ['progress', 'clear-text', 'html'],
  concurrency: '60%',
  coverageAnalysis: 'perTest',
  disableTypeChecks: 'src/**/*.{js,ts,jsx,tsx,html,vue}',
};
