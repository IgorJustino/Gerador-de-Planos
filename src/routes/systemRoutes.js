const express = require('express');
const { checkDatabase } = require('../config/database');

function createSystemRoutes({ pool }) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  router.get('/ready', async (req, res) => {
    try {
      await checkDatabase(pool);

      return res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: 'up',
        },
      });
    } catch (error) {
      console.error('[readiness] Banco indisponível:', error.message);

      return res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: 'down',
        },
      });
    }
  });

  return router;
}

module.exports = createSystemRoutes;
