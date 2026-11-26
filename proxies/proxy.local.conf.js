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
    // Backend fora do ar: responde 502 (como um proxy de produção) e não o 500 padrão do dev server.
    // O modo offline (ADR-003) trata 502/503/504 como "sem conexão" (cache de leitura e reenvio da fila).
    configure: proxy => {
      proxy.on('error', (err, req, res) => {
        if (res.writeHead && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
        }
        res.end('Bad Gateway');
      });
    },
  },
};
