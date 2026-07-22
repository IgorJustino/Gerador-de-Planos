const assert = require('node:assert/strict');
const test = require('node:test');

const { createBnccService } = require('../../src/services/bnccService');
const { createEmbeddingService, normalizeEmbeddingInput } = require('../../src/services/embeddingService');
const { buildLessonPlanPrompt } = require('../../src/services/promptBuilder');
const { createLessonPlanService } = require('../../src/services/lessonPlanService');

const skill = {
  id: 'skill-1',
  code: 'EF05CI01',
  educationStage: 'Ensino Fundamental',
  schoolYear: '5º ano',
  subject: 'Ciências',
  thematicUnit: 'Matéria e energia',
  knowledgeObject: 'Transformações',
  description: 'Explorar transformações de materiais e energia.',
  source: 'Seed fictício de demonstração',
  sourceVersion: 'demo',
  score: 0.91,
};

test('embedding service normaliza entrada e usa provider mockado', async () => {
  const service = createEmbeddingService({
    env: { embeddingDimension: 3, embeddingTimeoutMs: 1000 },
    provider: {
      async embed(text) {
        assert.equal(text, 'aula sobre energia');
        return [1, 0, 0];
      },
    },
  });

  assert.equal(normalizeEmbeddingInput(' aula   sobre\nenergia '), 'aula sobre energia');
  assert.deepEqual(await service.generateEmbedding(' aula   sobre\nenergia '), [1, 0, 0]);
});

test('bncc service executa busca textual e semântica com mocks', async () => {
  const calls = [];
  const service = createBnccService({
    db: {},
    embeddingService: {
      async generateEmbedding(query) {
        calls.push(query);
        return [1, 0, 0];
      },
    },
    repository: {
      async searchSkills(_db, filters) {
        assert.equal(filters.q, 'energia');
        return { items: [skill], page: 1, limit: 10, total: 1 };
      },
      async semanticSearch(_db, embedding, limit) {
        assert.deepEqual(embedding, [1, 0, 0]);
        assert.equal(limit, 5);
        return [skill];
      },
    },
  });

  const textual = await service.search({ q: 'energia' });
  assert.equal(textual.items[0].code, 'EF05CI01');
  const semantic = await service.semanticSearch({ query: 'aula energia', limit: 5 });
  assert.equal(semantic.items[0].score, 0.91);
  assert.deepEqual(calls, ['aula energia']);
});

test('prompt builder inclui contexto BNCC recuperado sem validação oficial automática', () => {
  const prompt = buildLessonPlanPrompt({
    tema: 'Fotossíntese',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
    codigoBNCC: 'EF05CI01',
    bnccContext: [{ ...skill, relationSource: 'selected' }],
  });

  assert.match(prompt, /<contexto_bncc>/);
  assert.match(prompt, /Código: EF05CI01/);
  assert.match(prompt, /Seed fictício de demonstração/);
  assert.match(prompt, /sem afirmar validação oficial automática/);
});

test('geração usa contexto BNCC e registra habilidades usadas', async () => {
  const attached = [];
  let promptUsed = '';
  const content = {
    titulo: 'Plano',
    resumo: 'Resumo suficientemente longo.',
    objetivos: ['Objetivo'],
    metodologia: ['Método'],
    recursos: [],
    etapas: [{ titulo: 'Aula', descricao: 'Descrição', duracaoMinutos: 50 }],
    avaliacao: ['Avaliação'],
    adaptacoes: [],
    habilidadesBNCC: [{ codigo: 'EF05CI01', descricao: 'Descrição' }],
  };
  const service = createLessonPlanService({
    db: {},
    geminiService: {
      async generateStructuredLessonPlan({ prompt }) {
        promptUsed = prompt;
        return { content, model: 'mock', promptVersion: 'lesson-plan-v1' };
      },
    },
    bnccService: {
      async resolveGenerationContext() {
        return [{ ...skill, relationSource: 'selected' }];
      },
      async attachSkillsToPlan({ planId, skills }) {
        attached.push({ planId, skills });
      },
      async findSkillsByPlan() {
        return [{ ...skill, relationSource: 'selected' }];
      },
    },
    repository: {
      async createLessonPlan(_db, input) {
        return {
          id: 'plan-1',
          tema: input.tema,
          nivel_ensino: input.nivelEnsino,
          duracao_minutos: input.duracaoMinutos,
          codigo_bncc: input.codigoBNCC,
          status: 'draft',
          content: input.content,
          current_version: 1,
          ai_model: input.aiModel,
          prompt_version: input.promptVersion,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      },
    },
  });

  const plan = await service.generateLessonPlan({
    userId: 'user-1',
    input: {
      tema: 'Fotossíntese',
      nivelEnsino: '5º ano',
      duracaoMinutos: 50,
      codigoBNCC: 'EF05CI01',
      bnccSkillId: 'skill-1',
    },
  });

  assert.match(promptUsed, /<contexto_bncc>/);
  assert.equal(attached[0].planId, 'plan-1');
  assert.equal(attached[0].skills[0].code, 'EF05CI01');
  assert.equal(plan.habilidadesBNCCUsadas[0].code, 'EF05CI01');
});
