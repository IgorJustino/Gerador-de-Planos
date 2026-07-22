const dotenv = require('dotenv');

dotenv.config();

function parseInteger(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseDurationToMs(value) {
  const match = String(value).trim().match(/^(\d+)\s*(s|m|h|d)$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[match[2].toLowerCase()];
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
    jwtSecret: source.JWT_SECRET || null,
    jwtExpiresIn: source.JWT_EXPIRES_IN || '8h',
    jwtExpiresInMs: parseDurationToMs(source.JWT_EXPIRES_IN || '8h'),
    cookieName: source.COOKIE_NAME || 'copiloto_session',
    cookieSecure: source.COOKIE_SECURE === 'true' || nodeEnv === 'production',
    cookieSameSite: (source.COOKIE_SAME_SITE || 'lax').toLowerCase(),
    authLoginRateLimitMax: parseInteger(source.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
    authRegisterRateLimitMax: parseInteger(source.AUTH_REGISTER_RATE_LIMIT_MAX, 5),
    authRateLimitWindowMs: parseInteger(
      source.AUTH_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    generationRateLimitMax: parseInteger(source.GENERATION_RATE_LIMIT_MAX, 5),
    generationRateLimitWindowMs: parseInteger(
      source.GENERATION_RATE_LIMIT_WINDOW_MS,
      60 * 60 * 1000
    ),
    geminiApiKey: source.GEMINI_API_KEY || null,
    geminiModel: source.GEMINI_MODEL || null,
    geminiTimeoutMs: parseInteger(source.GEMINI_TIMEOUT_MS, 30000),
    geminiMaxRetries: Math.min(
      Math.max(parseInteger(source.GEMINI_MAX_RETRIES, 1), 0),
      1
    ),
    embeddingModel: source.EMBEDDING_MODEL || 'text-embedding-004',
    embeddingDimension: parseInteger(source.EMBEDDING_DIMENSION, 768),
    embeddingTimeoutMs: parseInteger(source.EMBEDDING_TIMEOUT_MS, 15000),
  };
}

function validateEnv(env = getEnv(), options = {}) {
  const missing = [];

  if (options.requireDatabase && !env.databaseUrl) {
    missing.push('DATABASE_URL');
  }

  if (options.requireJwt && !env.jwtSecret) {
    missing.push('JWT_SECRET');
  }

  const validSameSite = ['lax', 'strict', 'none'];
  const invalidSameSite = !validSameSite.includes(env.cookieSameSite);
  const invalidDuration = !env.jwtExpiresInMs;

  const insecureProductionSecret =
    env.nodeEnv === 'production' && env.jwtSecret === 'dev-only-change-this-secret';

  if (
    missing.length > 0 ||
    invalidSameSite ||
    invalidDuration ||
    insecureProductionSecret
  ) {
    const details = [...missing];
    if (invalidSameSite) details.push('COOKIE_SAME_SITE');
    if (invalidDuration) details.push('JWT_EXPIRES_IN');
    if (insecureProductionSecret) details.push('JWT_SECRET');
    const error = new Error(
      `Configuração de ambiente inválida: ${details.join(', ')}`
    );
    error.code = 'ENV_VALIDATION_ERROR';
    error.missing = details;
    throw error;
  }

  return env;
}

module.exports = {
  getEnv,
  parseDurationToMs,
  validateEnv,
};
