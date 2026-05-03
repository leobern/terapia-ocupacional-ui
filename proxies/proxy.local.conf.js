/**
 * Proxy para backend local (Spring Boot rodando na máquina)
 * Usado em: ng serve --configuration local
 */
module.exports = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
  },
};
