const express = require('express');
const rateLimit = require('express-rate-limit');

const createAuthMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const createLessonPlanController = require('../controllers/lessonPlanController');
const {
  lessonPlanGenerationSchema,
  lessonPlanListQuerySchema,
  lessonPlanIdParamsSchema,
  lessonPlanVersionParamsSchema,
  lessonPlanUpdateSchema,
  lessonPlanStatusSchema,
} = require('../schemas/lessonPlanSchemas');

function createGenerationRateLimiter(env) {
  return rateLimit({
    windowMs: env.generationRateLimitWindowMs || 60 * 60 * 1000,
    max: env.generationRateLimitMax || 5,
    keyGenerator: (req) => `user:${req.user.id}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Limite de gerações atingido. Tente novamente mais tarde.',
        },
      });
    },
  });
}

function createLessonPlanRoutes({ authService, env, lessonPlanService }) {
  const router = express.Router();
  const authenticate = createAuthMiddleware({ authService, env });
  const controller = createLessonPlanController({ lessonPlanService });
  const generationRateLimiter = createGenerationRateLimiter(env);

  router.post(
    '/gerar',
    authenticate,
    generationRateLimiter,
    validate(lessonPlanGenerationSchema),
    controller.generate
  );
  router.get(
    '/',
    authenticate,
    validate(lessonPlanListQuerySchema, 'query'),
    controller.list
  );
  router.get(
    '/:id/versoes/:versionNumber',
    authenticate,
    validate(lessonPlanVersionParamsSchema, 'params'),
    controller.getVersion
  );
  router.get(
    '/:id/versoes',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    validate(lessonPlanListQuerySchema, 'query'),
    controller.listVersions
  );
  router.patch(
    '/:id/status',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    validate(lessonPlanStatusSchema),
    controller.updateStatus
  );
  router.patch(
    '/:id',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    validate(lessonPlanUpdateSchema),
    controller.update
  );
  router.delete(
    '/:id',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    controller.remove
  );
  router.get(
    '/:id',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    controller.findById
  );

  return router;
}

module.exports = createLessonPlanRoutes;
