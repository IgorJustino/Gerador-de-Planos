const { PROMPT_VERSION } = require('../config/ai');
const lessonPlanRepository = require('../repositories/lessonPlanRepository');
const lessonPlanVersionRepository = require('../repositories/lessonPlanVersionRepository');
const AppError = require('../utils/AppError');
const { validateLessonPlanContent } = require('../schemas/geminiSchemas');
const { buildLessonPlanPrompt } = require('./promptBuilder');

const STATUS_TRANSITIONS = {
  draft: new Set(['reviewed', 'archived']),
  reviewed: new Set(['draft', 'approved', 'archived']),
  approved: new Set(['reviewed', 'archived']),
  archived: new Set(['draft']),
};

function serializeLessonPlan(plan) {
  return {
    id: plan.id,
    tema: plan.tema,
    nivelEnsino: plan.nivel_ensino,
    duracaoMinutos: plan.duracao_minutos,
    codigoBNCC: plan.codigo_bncc,
    status: plan.status,
    conteudo: plan.content,
    versaoAtual: plan.current_version,
    modeloIA: plan.ai_model,
    versaoPrompt: plan.prompt_version,
    criadoEm: plan.created_at,
    atualizadoEm: plan.updated_at,
  };
}

function serializeLessonPlanVersion(version) {
  return {
    id: version.id,
    planId: version.lessonPlanId,
    versionNumber: version.versionNumber,
    source: version.source,
    tema: version.tema,
    nivelEnsino: version.nivelEnsino,
    duracaoMinutos: version.duracaoMinutos,
    codigoBNCC: version.codigoBNCC,
    conteudo: version.content,
    criadoEm: version.criadoEm,
  };
}

function mergeLessonPlanChanges(currentPlan, changes) {
  return {
    tema: changes.tema !== undefined ? changes.tema : currentPlan.tema,
    nivelEnsino: changes.nivelEnsino !== undefined
      ? changes.nivelEnsino
      : currentPlan.nivel_ensino,
    duracaoMinutos: changes.duracaoMinutos !== undefined
      ? changes.duracaoMinutos
      : currentPlan.duracao_minutos,
    codigoBNCC: changes.codigoBNCC !== undefined
      ? changes.codigoBNCC
      : currentPlan.codigo_bncc,
    content: changes.conteudo !== undefined ? changes.conteudo : currentPlan.content,
  };
}

function validationDetails(validation) {
  return validation.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'conteudo',
    message: issue.message,
  }));
}

function createLessonPlanService({
  db,
  geminiService,
  repository = lessonPlanRepository,
  versionRepository = lessonPlanVersionRepository,
}) {
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

  async function updateLessonPlan({ userId, id, expectedVersion, changes }) {
    const currentPlan = await repository.findLessonPlanByIdAndUser(db, id, userId);
    if (!currentPlan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    const snapshot = mergeLessonPlanChanges(currentPlan, changes);
    const contentChanged = changes.conteudo !== undefined;
    const durationChanged = changes.duracaoMinutos !== undefined;

    if (contentChanged || durationChanged) {
      const validation = validateLessonPlanContent(
        snapshot.content,
        snapshot.duracaoMinutos
      );

      if (!validation.success) {
        const hasDurationIssue = validation.error.issues.some(
          (issue) => issue.code === 'custom' && issue.path[0] === 'etapas'
        );

        if (hasDurationIssue) {
          throw new AppError(
            'A duração das etapas não é compatível com a duração total do plano.',
            400,
            'INVALID_PLAN_DURATION'
          );
        }

        throw new AppError(
          'Conteúdo do plano inválido',
          400,
          'VALIDATION_ERROR',
          validationDetails(validation)
        );
      }
    }

    const result = await versionRepository.createVersionAndUpdateCurrentPlan(db, {
      planId: id,
      userId,
      expectedVersion,
      source: 'manual',
      ...snapshot,
    });

    if (result.outcome === 'not_found') {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    if (result.outcome === 'version_conflict') {
      throw new AppError(
        'O plano foi alterado em outra sessão. Atualize os dados antes de salvar novamente.',
        409,
        'VERSION_CONFLICT'
      );
    }

    return serializeLessonPlan(result.plan);
  }

  async function listVersions({ userId, id, page, limit }) {
    const plan = await repository.findLessonPlanByIdAndUser(db, id, userId);
    if (!plan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    const result = await versionRepository.findVersionsByPlanAndUser(
      db,
      id,
      userId,
      { page, limit }
    );

    return {
      items: result.versions.map(serializeLessonPlanVersion),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.total > 0 ? Math.ceil(result.total / result.limit) : 0,
      },
    };
  }

  async function findVersion({ userId, id, versionNumber }) {
    const version = await versionRepository.findVersionByNumberAndUser(
      db,
      id,
      versionNumber,
      userId
    );

    if (!version) {
      throw new AppError('Versão não encontrada', 404, 'VERSION_NOT_FOUND');
    }

    return serializeLessonPlanVersion(version);
  }

  async function updateStatus({ userId, id, status }) {
    const currentPlan = await repository.findLessonPlanByIdAndUser(db, id, userId);
    if (!currentPlan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    if (currentPlan.status === status) {
      return serializeLessonPlan(currentPlan);
    }

    if (!STATUS_TRANSITIONS[currentPlan.status]?.has(status)) {
      throw new AppError(
        'A transição de status solicitada não é permitida.',
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updatedPlan = await repository.updateLessonPlanStatus(db, id, userId, status);
    if (!updatedPlan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    return serializeLessonPlan(updatedPlan);
  }

  async function deleteLessonPlan({ userId, id }) {
    const deleted = await repository.deleteLessonPlanByIdAndUser(db, id, userId);
    if (!deleted) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }
  }

  return {
    generateLessonPlan,
    listLessonPlans,
    findLessonPlan,
    updateLessonPlan,
    listVersions,
    findVersion,
    updateStatus,
    deleteLessonPlan,
  };
}

module.exports = {
  STATUS_TRANSITIONS,
  mergeLessonPlanChanges,
  serializeLessonPlanVersion,
  createLessonPlanService,
  serializeLessonPlan,
};
