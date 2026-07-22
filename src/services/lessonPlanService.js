const { PROMPT_VERSION } = require('../config/ai');
const lessonPlanRepository = require('../repositories/lessonPlanRepository');
const lessonPlanVersionRepository = require('../repositories/lessonPlanVersionRepository');
const AppError = require('../utils/AppError');
const { validateLessonPlanContent } = require('../schemas/geminiSchemas');
const {
  buildLessonPlanPrompt,
  buildLessonPlanRevisionPrompt,
} = require('./promptBuilder');
const {
  DEFAULT_QUALITY_THRESHOLD,
  calculateLessonPlanQuality,
} = require('./lessonPlanQualityService');

const STATUS_TRANSITIONS = {
  draft: new Set(['reviewed', 'archived']),
  reviewed: new Set(['draft', 'approved', 'archived']),
  approved: new Set(['reviewed', 'archived']),
  archived: new Set(['draft']),
};

function serializeLessonPlan(plan, qualityThreshold = DEFAULT_QUALITY_THRESHOLD) {
  const bnccSkills = plan.habilidadesBNCCUsadas || [];
  return {
    id: plan.id,
    tema: plan.tema,
    nivelEnsino: plan.nivel_ensino,
    duracaoMinutos: plan.duracao_minutos,
    etapaEnsino: plan.etapa_ensino || plan.nivel_ensino,
    serieAno: plan.serie_ano || null,
    disciplina: plan.disciplina || null,
    codigoBNCC: plan.codigo_bncc,
    status: plan.status,
    conteudo: plan.content,
    versaoAtual: plan.current_version,
    modeloIA: plan.ai_model,
    versaoPrompt: plan.prompt_version,
    criadoEm: plan.created_at,
    atualizadoEm: plan.updated_at,
    habilidadesBNCCUsadas: bnccSkills,
    alinhamentoBNCC: {
      status: bnccSkills.length > 0 ? 'confirmado' : 'não selecionado',
      quantidade: bnccSkills.length,
    },
    qualidade: calculateLessonPlanQuality(plan.content, plan.duracao_minutos, {
      threshold: qualityThreshold,
    }),
  };
}

function serializeLessonPlanVersion(version, qualityThreshold = DEFAULT_QUALITY_THRESHOLD) {
  return {
    id: version.id,
    planId: version.lessonPlanId,
    versionNumber: version.versionNumber,
    source: version.source,
    tema: version.tema,
    nivelEnsino: version.nivelEnsino,
    etapaEnsino: version.etapaEnsino || version.nivelEnsino,
    serieAno: version.serieAno || null,
    disciplina: version.disciplina || null,
    duracaoMinutos: version.duracaoMinutos,
    codigoBNCC: version.codigoBNCC,
    conteudo: version.content,
    qualidade: calculateLessonPlanQuality(version.content, version.duracaoMinutos, {
      threshold: qualityThreshold,
    }),
    criadoEm: version.criadoEm,
  };
}

function mergeLessonPlanChanges(currentPlan, changes) {
  return {
    tema: changes.tema !== undefined ? changes.tema : currentPlan.tema,
    nivelEnsino: changes.nivelEnsino !== undefined
      ? changes.nivelEnsino
      : currentPlan.nivel_ensino,
    etapaEnsino: changes.etapaEnsino !== undefined
      ? changes.etapaEnsino
      : currentPlan.etapa_ensino || currentPlan.nivel_ensino,
    serieAno: changes.serieAno !== undefined ? changes.serieAno : currentPlan.serie_ano,
    disciplina: changes.disciplina !== undefined ? changes.disciplina : currentPlan.disciplina,
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

function assertGeneratedContent(content, expectedDurationMinutes, allowedBnccCodes) {
  const validation = validateLessonPlanContent(content, expectedDurationMinutes, {
    allowedBnccCodes,
  });
  if (validation.success) return validation.data;

  throw new AppError(
    'O serviço de IA retornou um plano fora do formato esperado.',
    502,
    'AI_INVALID_RESPONSE',
    validationDetails(validation)
  );
}

function createLessonPlanService({
  db,
  env = {},
  geminiService,
  bnccService = null,
  repository = lessonPlanRepository,
  versionRepository = lessonPlanVersionRepository,
}) {
  const qualityThreshold = Number.isInteger(env.aiQualityMinScore)
    ? env.aiQualityMinScore
    : DEFAULT_QUALITY_THRESHOLD;
  const qualityReviewEnabled = env.aiQualityReviewEnabled !== false;

  async function generateLessonPlan({ userId, input }) {
    const bnccContext = bnccService
      ? await bnccService.resolveGenerationContext(input)
      : [];
    const prompt = buildLessonPlanPrompt({
      ...input,
      bnccContext,
    });
    const totalDurationMinutes = input.duracaoMinutos * (input.quantidadeAulas || 1);
    const generationOptions = {
      expectedDurationMinutes: totalDurationMinutes,
      allowedBnccCodes: bnccContext.map((skill) => skill.code),
    };
    let generated = await geminiService.generateStructuredLessonPlan({
      prompt,
      ...generationOptions,
    });
    let validatedContent = assertGeneratedContent(
      generated.content,
      totalDurationMinutes,
      bnccContext.map((skill) => skill.code)
    );
    const initialQuality = calculateLessonPlanQuality(
      validatedContent,
      totalDurationMinutes,
      { threshold: qualityThreshold }
    );

    if (qualityReviewEnabled && !initialQuality.aprovado) {
      const revisionPrompt = buildLessonPlanRevisionPrompt({
        basePrompt: prompt,
        content: validatedContent,
        qualityReport: initialQuality,
      });

      try {
        const revision = await geminiService.generateStructuredLessonPlan({
          prompt: revisionPrompt,
          ...generationOptions,
        });
        const revisedContent = assertGeneratedContent(
          revision.content,
          totalDurationMinutes,
          bnccContext.map((skill) => skill.code)
        );
        const revisedQuality = calculateLessonPlanQuality(
          revisedContent,
          totalDurationMinutes,
          { threshold: qualityThreshold }
        );

        if (revisedQuality.pontuacao > initialQuality.pontuacao) {
          generated = revision;
          validatedContent = revisedContent;
        }
      } catch (_error) {
        // O primeiro plano já é estruturalmente válido; indisponibilidade na revisão não bloqueia o professor.
      }
    }

    const plan = await repository.createLessonPlan(db, {
      userId,
      tema: input.tema,
      nivelEnsino: input.nivelEnsino,
      etapaEnsino: input.etapaEnsino || input.nivelEnsino,
      serieAno: input.serieAno || null,
      disciplina: input.disciplina || null,
      duracaoMinutos: totalDurationMinutes,
      codigoBNCC: input.codigoBNCC || null,
      status: 'draft',
      content: validatedContent,
      aiModel: generated.model,
      promptVersion: generated.promptVersion || PROMPT_VERSION,
    });

    if (bnccService && bnccContext.length > 0) {
      await bnccService.attachSkillsToPlan({ planId: plan.id, skills: bnccContext });
      plan.habilidadesBNCCUsadas = await bnccService.findSkillsByPlan(plan.id);
    }

    return serializeLessonPlan(plan, qualityThreshold);
  }

  async function listLessonPlans({ userId, page, limit, status, nivelEnsino, codigoBNCC, tema, sort }) {
    const result = await repository.findLessonPlansByUser(db, userId, {
      page,
      limit,
      status,
      nivelEnsino,
      codigoBNCC,
      tema,
      sort,
    });
    return {
      items: result.plans.map((plan) => serializeLessonPlan(plan, qualityThreshold)),
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
    if (plan && bnccService) {
      plan.habilidadesBNCCUsadas = await bnccService.findSkillsByPlan(plan.id);
    }
    return plan ? serializeLessonPlan(plan, qualityThreshold) : null;
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

    return serializeLessonPlan(result.plan, qualityThreshold);
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
      items: result.versions.map(
        (version) => serializeLessonPlanVersion(version, qualityThreshold)
      ),
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

    return serializeLessonPlanVersion(version, qualityThreshold);
  }

  async function updateStatus({ userId, id, status }) {
    const currentPlan = await repository.findLessonPlanByIdAndUser(db, id, userId);
    if (!currentPlan) {
      throw new AppError('Plano não encontrado', 404, 'PLAN_NOT_FOUND');
    }

    if (currentPlan.status === status) {
      return serializeLessonPlan(currentPlan, qualityThreshold);
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

    return serializeLessonPlan(updatedPlan, qualityThreshold);
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
