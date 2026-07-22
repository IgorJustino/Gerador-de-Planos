const express = require('express');

const createAuthMiddleware = require('../middleware/auth');
const createMetricsController = require('../controllers/metricsController');

function createMetricsRoutes({ authService, env, metricsService }) {
  const router = express.Router();
  const authenticate = createAuthMiddleware({ authService, env });
  const controller = createMetricsController({ metricsService });

  router.get('/summary', authenticate, controller.summary);

  return router;
}

module.exports = createMetricsRoutes;
