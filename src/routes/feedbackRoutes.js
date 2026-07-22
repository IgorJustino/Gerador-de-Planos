const express = require('express');

const createAuthMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const createFeedbackController = require('../controllers/feedbackController');
const { lessonPlanIdParamsSchema } = require('../schemas/lessonPlanSchemas');
const { feedbackSchema } = require('../schemas/feedbackSchemas');

function createFeedbackRoutes({ authService, env, feedbackService }) {
  const router = express.Router({ mergeParams: true });
  const authenticate = createAuthMiddleware({ authService, env });
  const controller = createFeedbackController({ feedbackService });

  router.get(
    '/',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    controller.find
  );

  router.post(
    '/',
    authenticate,
    validate(lessonPlanIdParamsSchema, 'params'),
    validate(feedbackSchema),
    controller.save
  );

  return router;
}

module.exports = createFeedbackRoutes;
