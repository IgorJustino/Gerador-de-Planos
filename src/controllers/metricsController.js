const asyncHandler = require('../utils/asyncHandler');

function createMetricsController({ metricsService }) {
  const summary = asyncHandler(async (req, res) => {
    const metrics = await metricsService.getSummary({ userId: req.user.id });
    res.status(200).json({ metrics });
  });

  return {
    summary,
  };
}

module.exports = createMetricsController;
