const { createApp } = require('./app');
const { getEnv, validateEnv } = require('./config/env');

function startServer() {
  const env = validateEnv(getEnv(), { requireDatabase: process.env.NODE_ENV === 'production' });
  const app = createApp({ env });
  const server = app.listen(env.port, () => {
    console.log(`[server] Aplicação ouvindo na porta ${env.port}`);
    console.log(`[server] Health: http://localhost:${env.port}/health`);
    console.log(`[server] Readiness: http://localhost:${env.port}/ready`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[server] Encerrando por ${signal}...`);

    server.close(async () => {
      if (app.locals.db && typeof app.locals.db.end === 'function') {
        await app.locals.db.end();
      }

      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
