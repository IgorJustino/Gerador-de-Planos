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

  const update = asyncHandler(async (req, res) => {
    const plan = await lessonPlanService.updateLessonPlan({
      userId: req.user.id,
      id: req.params.id,
      expectedVersion: req.body.expectedVersion,
      changes: req.body,
    });

    res.status(200).json({ plano: plan });
  });

  const listVersions = asyncHandler(async (req, res) => {
    const result = await lessonPlanService.listVersions({
      userId: req.user.id,
      id: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.status(200).json(result);
  });

  const getVersion = asyncHandler(async (req, res) => {
    const version = await lessonPlanService.findVersion({
      userId: req.user.id,
      id: req.params.id,
      versionNumber: req.params.versionNumber,
    });

    res.status(200).json({ versao: version });
  });

  const updateStatus = asyncHandler(async (req, res) => {
    const plan = await lessonPlanService.updateStatus({
      userId: req.user.id,
      id: req.params.id,
      status: req.body.status,
    });

    res.status(200).json({ plano: plan });
  });

  const remove = asyncHandler(async (req, res) => {
    await lessonPlanService.deleteLessonPlan({
      userId: req.user.id,
      id: req.params.id,
    });

    res.status(204).end();
  });

  return {
    generate,
    list,
    findById,
    update,
    listVersions,
    getVersion,
    updateStatus,
    remove,
  };
}

module.exports = createLessonPlanController;
