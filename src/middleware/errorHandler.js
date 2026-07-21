function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : error.message || 'Erro interno do servidor';

  if (statusCode >= 500) {
    console.error('[http] Erro não tratado:', error);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

module.exports = errorHandler;
