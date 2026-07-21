const { Pool } = require('pg');

function createUnconfiguredPool() {
  const error = new Error('DATABASE_URL não configurada');
  error.code = 'DATABASE_URL_MISSING';

  return {
    query: async () => {
      throw error;
    },
    end: async () => {},
  };
}

function createPool(env) {
  if (!env.databaseUrl) {
    return createUnconfiguredPool();
  }

  const pool = new Pool({
    connectionString: env.databaseUrl,
    max: env.databasePoolMax,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (error) => {
    console.error('[database] Erro inesperado no pool:', error.message);
  });

  return pool;
}

async function checkDatabase(pool) {
  await pool.query('SELECT 1');
  return true;
}

module.exports = {
  createPool,
  checkDatabase,
};
