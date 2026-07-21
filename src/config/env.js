const dotenv = require('dotenv');

dotenv.config();

function parseInteger(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function getEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';

  return {
    nodeEnv,
    port: parseInteger(source.PORT, 3000),
    databaseUrl: source.DATABASE_URL || null,
    databasePoolMax: parseInteger(source.DATABASE_POOL_MAX, 5),
    databaseSsl: source.DATABASE_SSL === 'true' || nodeEnv === 'production',
    corsOrigin: source.CORS_ORIGIN || 'http://localhost:3000',
    legacy: {
      supabaseUrl: source.SUPABASE_URL || null,
      supabaseAnonKey: source.SUPABASE_ANON_KEY || null,
      geminiApiKey: source.GEMINI_API_KEY || null,
      geminiModel: source.GEMINI_MODEL || null,
    },
  };
}

function validateEnv(env = getEnv(), options = {}) {
  const required = options.requireDatabase ? ['DATABASE_URL'] : [];
  const missing = required.filter((name) => {
    if (name === 'DATABASE_URL') {
      return !env.databaseUrl;
    }

    return false;
  });

  if (missing.length > 0) {
    const error = new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`
    );
    error.code = 'ENV_VALIDATION_ERROR';
    error.missing = missing;
    throw error;
  }

  return env;
}

module.exports = {
  getEnv,
  validateEnv,
};
