/**
 * Proxy para ambiente remoto (dev/homologação)
 * Usado em: ng serve --configuration remote
 * Ajuste a URL conforme o ambiente remoto
 */
module.exports = {
  '/api': {
    target: 'https://api.terapia-nutricional.dev',
    secure: true,
    changeOrigin: true,
    logLevel: 'debug',
  },
};
