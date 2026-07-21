const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { getEnv } = require('./config/env');
const { createPool } = require('./config/database');
const createSystemRoutes = require('./routes/systemRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const { createAuthService } = require('./services/authService');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

function hasLegacyConfiguration(env) {
  return Boolean(
    env.legacy.supabaseUrl &&
    env.legacy.supabaseAnonKey &&
    env.legacy.geminiApiKey
  );
}

function registerLegacyPlanRoutes(app, env) {
  if (hasLegacyConfiguration(env)) {
    try {
      // Mantém o fluxo antigo disponível enquanto o MVP não o substitui.
      const planoRoutes = require('./routes/planoRoutes');
      app.use('/api/planos', planoRoutes);
      return;
    } catch (error) {
      console.error('[legacy] Não foi possível carregar as rotas antigas:', error.message);
    }
  }

  app.use('/api/planos', (req, res) => {
    res.status(503).json({
      sucesso: false,
      erro: 'As rotas legadas de planos estão desabilitadas neste ambiente.',
      code: 'LEGACY_ROUTES_DISABLED',
    });
  });
}

function createApp(options = {}) {
  const env = options.env || getEnv();
  const pool = options.pool || createPool(env);
  const authService = options.authService || createAuthService({ db: pool, env });
  const app = express();

  app.disable('x-powered-by');
  app.locals.env = env;
  app.locals.db = pool;

  app.use(cors({
    origin: env.corsOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, '../public')));

  app.use((req, res, next) => {
    console.log(`[http] ${req.method} ${req.path}`);
    next();
  });

  app.get('/api', (req, res) => {
    res.json({
      mensagem: 'API Gerador de Planos de Aula com IA',
      versao: '2.0.0-foundation',
      status: 'online',
      legadoPlanosHabilitado: hasLegacyConfiguration(env),
      endpoints: {
        health: 'GET /health',
        readiness: 'GET /ready',
        gerarPlanoLegado: 'POST /api/planos/gerar',
      },
    });
  });

  app.use(createSystemRoutes({ pool }));
  app.use('/api/auth', createAuthRoutes({ authService, env }));
  registerLegacyPlanRoutes(app, env);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
  hasLegacyConfiguration,
};
