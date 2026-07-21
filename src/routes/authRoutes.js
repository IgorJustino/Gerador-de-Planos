const express = require('express');
const rateLimit = require('express-rate-limit');

const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');
const createAuthController = require('../controllers/authController');
const createAuthMiddleware = require('../middleware/auth');

function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Muitas tentativas. Tente novamente mais tarde.',
        },
      });
    },
  });
}

function createAuthRoutes({ authService, env }) {
  const router = express.Router();
  const controller = createAuthController({ authService, env });
  const authenticate = createAuthMiddleware({ authService, env });
  const windowMs = env.authRateLimitWindowMs;
  const loginLimiter = createRateLimiter({
    windowMs,
    max: env.authLoginRateLimitMax,
  });
  const registerLimiter = createRateLimiter({
    windowMs: Math.max(windowMs, 60 * 60 * 1000),
    max: env.authRegisterRateLimitMax,
  });

  router.post('/register', registerLimiter, validate(registerSchema), controller.register);
  router.post('/login', loginLimiter, validate(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}

module.exports = createAuthRoutes;
