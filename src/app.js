const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { getEnv } = require('./config/env');
const { createPool } = require('./config/database');
const createSystemRoutes = require('./routes/systemRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const createLessonPlanRoutes = require('./routes/lessonPlanRoutes');
const { createAuthService } = require('./services/authService');
const { createGeminiService } = require('./services/structuredGeminiService');
const { createLessonPlanService } = require('./services/lessonPlanService');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

function createApp(options = {}) {
  const env = options.env || getEnv();
  const pool = options.pool || createPool(env);
  const authService = options.authService || createAuthService({ db: pool, env });
  const geminiService = options.geminiService || createGeminiService({ env });
  const lessonPlanService = options.lessonPlanService || createLessonPlanService({
    db: pool,
    geminiService,
  });
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
      endpoints: {
        health: 'GET /health',
        readiness: 'GET /ready',
        gerarPlano: 'POST /api/planos/gerar',
        listarPlanos: 'GET /api/planos',
      },
    });
  });

  app.use(createSystemRoutes({ pool }));
  app.use('/api/auth', createAuthRoutes({ authService, env }));
  app.use('/api/planos', createLessonPlanRoutes({
    authService,
    env,
    lessonPlanService,
  }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
