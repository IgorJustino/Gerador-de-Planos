const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
}

module.exports = notFoundHandler;
