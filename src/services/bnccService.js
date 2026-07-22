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

function normalizeSubjectArea(subject) {
  const value = String(subject || '').toLowerCase();
  if (/hist|geo|socio|filos/.test(value)) return 'Ciências Humanas';
  if (/bio|qu[ií]m|f[ií]s|ci[eê]nc/.test(value)) return 'Ciências da Natureza';
  return subject;
}

const RECOMMENDATION_PRESETS = [
  {
    area: 'Ciências Humanas',
    keywords: ['alexandre', 'império', 'imperio', 'antiguidade', 'território', 'territorio', 'conquista', 'cultura'],
    codes: ['EM13CHS103', 'EM13CHS204', 'EM13CHS101', 'EM13CHS104'],
  },
];

const SKILL_TAGS = {
  EM13CHS101: ['análise de fontes', 'comparação', 'narrativas', 'pensamento crítico'],
  EM13CHS103: ['hipótese', 'evidências', 'argumentação', 'dados qualitativos'],
  EM13CHS104: ['cultura material', 'práticas culturais', 'valores', 'sociedades'],
  EM13CHS204: ['território', 'fronteiras', 'impérios', 'diversidade cultural'],
};

function enrichRecommendation(skill) {
  const tags = SKILL_TAGS[skill.code] || [];
  return {
    ...skill,
    tags,
    reason: tags.length > 0
      ? `Relaciona-se a ${tags.slice(0, 3).join(', ')}.`
      : 'Relaciona-se ao tema, à disciplina e ao recorte informado.',
  };
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

  async function semanticSearch({ query, limit, subject, educationStage, schoolYear }) {
    const embedding = await embeddingService.generateEmbedding(query);
    return {
      items: await repository.semanticSearch(db, embedding, limit, {
        subject: normalizeSubjectArea(subject),
        educationStage,
        schoolYear,
      }),
    };
  }

  async function recommendSkills({ tema, disciplina, etapaEnsino, serieAno, limit = 3 }) {
    const area = normalizeSubjectArea(disciplina);
    const normalizedTheme = String(tema || '').toLowerCase();
    const preset = RECOMMENDATION_PRESETS.find((item) => (
      item.area === area && item.keywords.some((keyword) => normalizedTheme.includes(keyword))
    ));

    if (preset) {
      const candidates = [];
      for (const code of preset.codes) {
        const skill = await repository.findSkillByCode(db, code);
        if (!skill) continue;
        if (skill.educationStage && !skill.educationStage.toLowerCase().includes(etapaEnsino.toLowerCase())) continue;
        candidates.push(enrichRecommendation({
          ...skill,
          score: 1 - candidates.length * 0.05,
          recommendationSource: 'preset',
        }));
        if (candidates.length >= limit) break;
      }
      if (candidates.length > 0) return { items: candidates };
    }

    const semantic = await semanticSearch({
      query: `${tema} ${disciplina} ${serieAno}`,
      limit,
      subject: disciplina,
      educationStage: etapaEnsino,
      schoolYear: etapaEnsino === 'Ensino Médio' ? undefined : serieAno,
    });
    return { items: semantic.items.map(enrichRecommendation) };
  }

  async function ensureSkillEmbedding(skill) {
    if (!skill || skill.score !== null) return skill;
    const embedding = await embeddingService.generateEmbedding(buildSkillText(skill));
    return repository.updateSkillEmbedding(db, skill.id, embedding);
  }

  async function resolveGenerationContext({
    tema,
    nivelEnsino,
    etapaEnsino,
    serieAno,
    disciplina,
    codigoBNCC,
    bnccSkillId,
  }) {
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
      const query = `${tema || ''} ${disciplina || ''} ${etapaEnsino || nivelEnsino || ''} ${serieAno || ''}`.trim();
      if (!query) return [];
      const embedding = await embeddingService.generateEmbedding(query);
      const retrieved = await repository.semanticSearch(db, embedding, 3, {
        subject: normalizeSubjectArea(disciplina),
        educationStage: etapaEnsino || nivelEnsino,
        schoolYear: serieAno,
      });
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
    recommendSkills,
    ensureSkillEmbedding,
    resolveGenerationContext,
    attachSkillsToPlan,
    findSkillsByPlan,
  };
}

module.exports = {
  buildSkillText,
  normalizeSubjectArea,
  createBnccService,
};
