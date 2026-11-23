const fs = require('fs');
const path = require('path');

/**
 * Roda os testes no Chromium do Playwright (de preferência o chrome-headless-shell),
 * e não no Google Chrome instalado na máquina. No Windows, cada abertura do Chrome
 * instalado gerava uma tentativa de logon com senha errada (evento 4625), e várias
 * rodadas seguidas bloqueavam a conta do Windows (política de 10 falhas em 10 min).
 * Se CHROME_BIN já estiver definido, ele é respeitado; sem Playwright instalado,
 * o karma-chrome-launcher volta a procurar o Chrome do sistema.
 */
function resolvePlaywrightChromium() {
  try {
    const { chromium } = require('@playwright/test');
    const full = chromium.executablePath();
    const headlessShell = full
      .replace(/chromium-(\d+)/, 'chromium_headless_shell-$1')
      .replace(/chrome-(win64|linux64|linux|mac-x64|mac-arm64)/, 'chrome-headless-shell-$1')
      .replace(/chrome(\.exe)?$/, 'chrome-headless-shell$1');

    return [headlessShell, full].find((candidate) => fs.existsSync(candidate));
  } catch {
    return undefined;
  }
}

if (!process.env.CHROME_BIN) {
  const playwrightChromium = resolvePlaywrightChromium();

  if (playwrightChromium) {
    process.env.CHROME_BIN = playwrightChromium;
  }
}

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
