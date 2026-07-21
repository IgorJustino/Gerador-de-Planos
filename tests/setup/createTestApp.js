const { createApp } = require('../../src/app');

function createTestApp({ databaseAvailable = true } = {}) {
  const pool = {
    query: async () => {
      if (!databaseAvailable) {
        throw new Error('database unavailable');
      }

      return { rows: [{ '?column?': 1 }] };
    },
    end: async () => {},
  };

  const app = createApp({
    env: {
      nodeEnv: 'test',
      port: 0,
      databaseUrl: 'postgresql://test',
      databasePoolMax: 1,
      databaseSsl: false,
      corsOrigin: 'http://localhost:3000',
      legacy: {
        supabaseUrl: null,
        supabaseAnonKey: null,
        geminiApiKey: null,
        geminiModel: null,
      },
    },
    pool,
  });

  return { app, pool };
}

module.exports = {
  createTestApp,
};
