const AppError = require('../utils/AppError');
const bnccRepository = require('../repositories/bnccRepository');

function buildSkillText(skill) {
  return [
    skill.code,
    skill.subject,
    skill.educationStage,
    skill.schoolYear,
    skill.thematicUnit,
    skill.knowledgeObject,
    skill.description,
  ].filter(Boolean).join(' | ');
}

function createBnccService({
  db,
  embeddingService,
  repository = bnccRepository,
}) {
  async function search(filters) {
    const result = await repository.searchSkills(db, filters);
    return {
      items: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.total > 0 ? Math.ceil(result.total / result.limit) : 0,
      },
    };
  }

  async function findByCode(code) {
    const skill = await repository.findSkillByCode(db, String(code).toUpperCase());
    if (!skill) {
      throw new AppError('Habilidade BNCC não encontrada', 404, 'BNCC_SKILL_NOT_FOUND');
    }
    return skill;
  }

  async function semanticSearch({ query, limit }) {
    const embedding = await embeddingService.generateEmbedding(query);
    return {
      items: await repository.semanticSearch(db, embedding, limit),
    };
  }

  async function ensureSkillEmbedding(skill) {
    if (!skill || skill.score !== null) return skill;
    const embedding = await embeddingService.generateEmbedding(buildSkillText(skill));
    return repository.updateSkillEmbedding(db, skill.id, embedding);
  }

  async function resolveGenerationContext({ tema, nivelEnsino, codigoBNCC, bnccSkillId }) {
    if (bnccSkillId) {
      const selected = await repository.findSkillById(db, bnccSkillId);
      if (!selected) {
        throw new AppError('Habilidade BNCC selecionada não encontrada', 400, 'BNCC_SKILL_NOT_FOUND');
      }
      return [{ ...selected, relationSource: 'selected', score: 1 }];
    }

    if (codigoBNCC) {
      const selected = await repository.findSkillByCode(db, codigoBNCC);
      if (selected) return [{ ...selected, relationSource: 'selected', score: 1 }];
    }

    try {
      const query = `${tema || ''} ${nivelEnsino || ''}`.trim();
      if (!query) return [];
      const embedding = await embeddingService.generateEmbedding(query);
      const retrieved = await repository.semanticSearch(db, embedding, 3);
      return retrieved.map((skill) => ({
        ...skill,
        relationSource: 'retrieved',
      }));
    } catch (_error) {
      return [];
    }
  }

  async function attachSkillsToPlan({ planId, skills }) {
    const payload = skills.map((skill) => ({
      id: skill.id,
      score: skill.score,
      source: skill.relationSource === 'selected' ? 'selected' : 'retrieved',
    }));
    await repository.attachSkillsToPlan(db, planId, payload);
  }

  async function findSkillsByPlan(planId) {
    return repository.findSkillsByPlan(db, planId);
  }

  return {
    search,
    findByCode,
    semanticSearch,
    ensureSkillEmbedding,
    resolveGenerationContext,
    attachSkillsToPlan,
    findSkillsByPlan,
  };
}

module.exports = {
  buildSkillText,
  createBnccService,
};
