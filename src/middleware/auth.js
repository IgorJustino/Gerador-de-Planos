const AppError = require('../utils/AppError');

function createAuthMiddleware({ authService, env }) {
  return async (req, res, next) => {
    const token = req.cookies && req.cookies[env.cookieName];

    if (!token) {
      return next(new AppError('Autenticação necessária', 401, 'UNAUTHORIZED'));
    }

    try {
      const payload = authService.verifyToken(token);
      req.user = await authService.getAuthenticatedUser(payload.sub);
      return next();
    } catch (_error) {
      return next(new AppError('Autenticação necessária', 401, 'UNAUTHORIZED'));
    }
  };
}

module.exports = createAuthMiddleware;
