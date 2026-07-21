const { PROMPT_VERSION } = require('../config/ai');
const lessonPlanRepository = require('../repositories/lessonPlanRepository');
const { buildLessonPlanPrompt } = require('./promptBuilder');

function serializeLessonPlan(plan) {
  return {
    id: plan.id,
    tema: plan.tema,
    nivelEnsino: plan.nivel_ensino,
    duracaoMinutos: plan.duracao_minutos,
    codigoBNCC: plan.codigo_bncc,
    status: plan.status,
    conteudo: plan.content,
    modeloIA: plan.ai_model,
    versaoPrompt: plan.prompt_version,
    criadoEm: plan.created_at,
    atualizadoEm: plan.updated_at,
  };
}

function createLessonPlanService({ db, geminiService, repository = lessonPlanRepository }) {
  async function generateLessonPlan({ userId, input }) {
    const prompt = buildLessonPlanPrompt(input);
    const generated = await geminiService.generateStructuredLessonPlan({
      prompt,
      expectedDurationMinutes: input.duracaoMinutos,
    });

    const plan = await repository.createLessonPlan(db, {
      userId,
      tema: input.tema,
      nivelEnsino: input.nivelEnsino,
      duracaoMinutos: input.duracaoMinutos,
      codigoBNCC: input.codigoBNCC || null,
      status: 'draft',
      content: generated.content,
      aiModel: generated.model,
      promptVersion: generated.promptVersion || PROMPT_VERSION,
    });

    return serializeLessonPlan(plan);
  }

  async function listLessonPlans({ userId, page, limit }) {
    const result = await repository.findLessonPlansByUser(db, userId, { page, limit });
    return {
      items: result.plans.map(serializeLessonPlan),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.total > 0 ? Math.ceil(result.total / result.limit) : 0,
      },
    };
  }

  async function findLessonPlan({ userId, id }) {
    const plan = await repository.findLessonPlanByIdAndUser(db, id, userId);
    return plan ? serializeLessonPlan(plan) : null;
  }

  return {
    generateLessonPlan,
    listLessonPlans,
    findLessonPlan,
  };
}

module.exports = {
  createLessonPlanService,
  serializeLessonPlan,
};
