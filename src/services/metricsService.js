const metricsRepository = require('../repositories/metricsRepository');

const STATUSES = ['draft', 'reviewed', 'approved', 'archived'];

function createMetricsService({ db, repository = metricsRepository }) {
  async function getSummary({ userId }) {
    const raw = await repository.getSummaryByUser(db, userId);
    const totalPlans = raw.totalPlans;
    const totalVersions = raw.totalVersions;
    const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));

    raw.statusCounts.forEach((row) => {
      byStatus[row.status] = row.total;
    });

    const feedbackTotal = raw.feedbacks.total || 0;
    const averageRating = raw.feedbacks.average_rating === null
      ? null
      : Number(raw.feedbacks.average_rating.toFixed(2));
    const usefulPercentage = raw.feedbacks.useful_ratio === null
      ? null
      : Number((raw.feedbacks.useful_ratio * 100).toFixed(2));

    return {
      totalPlanos: totalPlans,
      planosPorStatus: byStatus,
      totalVersoes: totalVersions,
      mediaVersoesPorPlano: totalPlans > 0
        ? Number((totalVersions / totalPlans).toFixed(2))
        : 0,
      totalFeedbacks: feedbackTotal,
      notaMedia: averageRating,
      percentualUteis: usefulPercentage,
      planosUltimos7Dias: raw.recentPlansLast7Days,
      ultimosPlanos: raw.latestPlans.map((plan) => ({
        id: plan.id,
        tema: plan.tema,
        status: plan.status,
        criadoEm: plan.created_at,
        atualizadoEm: plan.updated_at,
      })),
    };
  }

  return {
    getSummary,
  };
}

module.exports = {
  createMetricsService,
};
