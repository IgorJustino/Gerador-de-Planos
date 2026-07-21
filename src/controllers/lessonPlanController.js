const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function createLessonPlanController({ lessonPlanService }) {
  const generate = asyncHandler(async (req, res) => {
    const plan = await lessonPlanService.generateLessonPlan({
      userId: req.user.id,
      input: req.body,
    });

    res.status(201).json({ plano: plan });
  });

  const list = asyncHandler(async (req, res) => {
    const result = await lessonPlanService.listLessonPlans({
      userId: req.user.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.status(200).json(result);
  });

  const findById = asyncHandler(async (req, res) => {
    const plan = await lessonPlanService.findLessonPlan({
      userId: req.user.id,
      id: req.params.id,
    });

    if (!plan) {
      throw new AppError('Plano não encontrado', 404, 'NOT_FOUND');
    }

    res.status(200).json({ plano: plan });
  });

  return {
    generate,
    list,
    findById,
  };
}

module.exports = createLessonPlanController;
