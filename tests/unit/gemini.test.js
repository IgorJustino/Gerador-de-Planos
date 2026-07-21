const assert = require('node:assert/strict');
const test = require('node:test');

const { PROMPT_VERSION, buildLessonPlanPrompt } = require('../../src/services/promptBuilder');
const {
  validateLessonPlanContent,
} = require('../../src/schemas/geminiSchemas');
const {
  createGeminiService,
  parseProviderContent,
  stripJsonFence,
} = require('../../src/services/structuredGeminiService');

function validContent() {
  return {
    titulo: 'Fotossíntese em sala',
    resumo: 'Plano introdutório para compreender como as plantas produzem energia.',
    objetivos: ['Compreender os elementos da fotossíntese'],
    metodologia: ['Exposição dialogada'],
    recursos: ['Quadro'],
    etapas: [
      { titulo: 'Introdução', descricao: 'Levantamento de conhecimentos prévios.', duracaoMinutos: 10 },
      { titulo: 'Desenvolvimento', descricao: 'Explicação e atividade prática.', duracaoMinutos: 30 },
      { titulo: 'Síntese', descricao: 'Verificação do aprendizado.', duracaoMinutos: 10 },
    ],
    avaliacao: ['Participação e atividade final'],
    adaptacoes: [],
    habilidadesBNCC: [],
  };
}

test('prompt builder delimita entrada e centraliza a versão', () => {
  const prompt = buildLessonPlanPrompt({
    tema: 'Fotossíntese',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
    codigoBNCC: 'EF05CI01',
    contextoAdicional: 'Turma com 25 estudantes',
  });

  assert.match(prompt, new RegExp(PROMPT_VERSION));
  assert.match(prompt, /<dados_usuario>/);
  assert.match(prompt, /Fotossíntese/);
  assert.match(prompt, /50 minutos/);
  assert.doesNotMatch(prompt, /GEMINI_API_KEY|DATABASE_URL/);
});

test('valida a soma das etapas com tolerância de 10% e mínimo de cinco minutos', () => {
  assert.equal(validateLessonPlanContent(validContent(), 50).success, true);
  assert.equal(validateLessonPlanContent({ ...validContent(), etapas: [
    { titulo: 'Etapa', descricao: 'Descrição suficiente.', duracaoMinutos: 20 },
  ] }, 50).success, false);
});

test('serviço Gemini faz no máximo uma retentativa após resposta inválida', async () => {
  let calls = 0;
  const service = createGeminiService({
    env: {
      geminiApiKey: 'test-key',
      geminiModel: 'test-model',
      geminiTimeoutMs: 100,
      geminiMaxRetries: 1,
    },
    provider: {
      async generate() {
        calls += 1;
        return { content: calls === 1 ? '{invalido' : validContent(), model: 'test-model' };
      },
    },
  });

  const result = await service.generateStructuredLessonPlan({
    prompt: 'prompt de teste',
    expectedDurationMinutes: 50,
  });

  assert.equal(calls, 2);
  assert.equal(result.content.titulo, 'Fotossíntese em sala');
});

test('serviço Gemini não repete erro do provider', async () => {
  let calls = 0;
  const service = createGeminiService({
    env: {
      geminiApiKey: 'test-key',
      geminiModel: 'test-model',
      geminiTimeoutMs: 100,
      geminiMaxRetries: 1,
    },
    provider: {
      async generate() {
        calls += 1;
        const error = new Error('provider indisponível');
        error.status = 500;
        throw error;
      },
    },
  });

  await assert.rejects(
    service.generateStructuredLessonPlan({ prompt: 'teste', expectedDurationMinutes: 50 }),
    (error) => error.code === 'AI_PROVIDER_ERROR'
  );
  assert.equal(calls, 1);
});

test('parser aceita objeto e cerca JSON controlada', () => {
  const content = validContent();
  assert.deepEqual(parseProviderContent(content), content);
  assert.equal(stripJsonFence('```json\n{"ok":true}\n```'), '{"ok":true}');
});
