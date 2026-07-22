const AppError = require('../utils/AppError');
const lessonPlanRepository = require('../repositories/lessonPlanRepository');
const feedbackRepository = require('../repositories/feedbackRepository');

function createFeedbackService({
  db,
  planRepository = lessonPlanRepository,
  repository = feedbackRepository,
}) {
  async function ensureOwnedPlan({ userId, planId }) {
    const plan = await planRepository.findLessonPlanByIdAndUser(db, planId, userId);
    if (!plan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }
    return plan;
  }

  async function saveFeedback({ userId, planId, input }) {
    await ensureOwnedPlan({ userId, planId });
    return repository.upsertFeedback(db, {
      lessonPlanId: planId,
      userId,
      rating: input.rating,
      useful: input.useful,
      usedInClass: input.usedInClass === undefined ? null : input.usedInClass,
      comment: input.comment || null,
    });
  }

  async function findFeedback({ userId, planId }) {
    await ensureOwnedPlan({ userId, planId });
    return repository.findFeedbackByPlanAndUser(db, planId, userId);
  }

  return {
    saveFeedback,
    findFeedback,
  };
}

module.exports = {
  createFeedbackService,
};
