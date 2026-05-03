const path = require('path');

const threshold = {
  emitWarning: false,
  global: {
    statements: 99,
    lines: 99,
    branches: 95,
    functions: 99,
  },
  each: {
    statements: 90,
    lines: 90,
    branches: 50,
    functions: 90,
  },
};

/** @return {import('karma').ConfigOptions} */
module.exports = function (config) {
  const isWatchMode = process.argv.includes('--watch');

  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reportSlowerThan: 150,
    coverageReporter: {
      reporters: [
        { type: 'html', subdir: '.' },
        { type: 'lcovonly', subdir: '.' },
        { type: 'text-summary', subdir: '.' },
      ],
      check: isWatchMode ? {} : threshold,
      dir: path.join(__dirname, 'dist/coverage'),
      includeAllSources: true,
    },
    reporters: ['progress', 'coverage'],
    customLaunchers: {
      ChromeDebuggingHeadless: {
        base: 'Chrome',
        flags: [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--remote-debugging-port=9222',
        ],
      },
      ChromeDebugging: {
        base: 'Chrome',
        flags: ['--remote-debugging-port=9333'],
      },
    },
    browsers: ['ChromeHeadless'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
  });
};
