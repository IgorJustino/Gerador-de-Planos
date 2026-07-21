const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));

      return next(new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', details));
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = validate;
