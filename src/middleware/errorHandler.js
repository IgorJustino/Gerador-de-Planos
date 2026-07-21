function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : error.message || 'Erro interno do servidor';

  if (statusCode >= 500) {
    console.error('[http] Erro não tratado:', error);
  }

  const response = {
    error: {
      code,
      message,
    },
  };

  if (Array.isArray(error.details) && error.details.length > 0) {
    response.error.details = error.details;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
