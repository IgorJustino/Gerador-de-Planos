const express = require('express');

const createAuthMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const createBnccController = require('../controllers/bnccController');
const {
  bnccSearchQuerySchema,
  bnccCodeParamsSchema,
  bnccSemanticSearchSchema,
} = require('../schemas/bnccSchemas');

function createBnccRoutes({ authService, env, bnccService }) {
  const router = express.Router();
  const authenticate = createAuthMiddleware({ authService, env });
  const controller = createBnccController({ bnccService });

  router.get(
    '/search',
    authenticate,
    validate(bnccSearchQuerySchema, 'query'),
    controller.search
  );

  router.post(
    '/semantic-search',
    authenticate,
    validate(bnccSemanticSearchSchema),
    controller.semanticSearch
  );

  router.get(
    '/:code',
    authenticate,
    validate(bnccCodeParamsSchema, 'params'),
    controller.findByCode
  );

  return router;
}

module.exports = createBnccRoutes;
