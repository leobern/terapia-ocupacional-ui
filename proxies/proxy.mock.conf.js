/**
 * Proxy para mock server local (ng-apimock / json-server)
 * Usado em: ng serve --configuration development
 */
module.exports = {
  '/api': {
    target: 'http://localhost:3000',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    logLevel: 'debug',
  },
};
