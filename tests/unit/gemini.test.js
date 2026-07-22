const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
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
  return createValidLessonPlanContent();
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
  assert.match(prompt, /ação observável/);
  assert.match(prompt, /objetivosRelacionados/);
  assert.match(prompt, /Nunca crie, complete ou deduza códigos BNCC/);
  assert.match(prompt, /Não aceite automaticamente afirmações causais/);
  assert.match(prompt, /Atividades contrafactuais devem definir um ponto de divergência/);
  assert.match(prompt, /REGRAS PARA SEQUÊNCIAS DIDÁTICAS/);
  assert.match(prompt, /adequado, parcial e insuficiente/);
  assert.match(prompt, /aulaNumero/);
  assert.match(prompt, /momentos/);
  assert.match(prompt, /acaoProfessor/);
  assert.match(prompt, /narrativas antigas posteriores/);
  assert.doesNotMatch(prompt, /fontes primárias/);
  assert.match(prompt, /adaptações universais/);
  assert.match(prompt, /avaliar explicitamente todos os objetivos/);
  assert.doesNotMatch(prompt, /GEMINI_API_KEY|DATABASE_URL/);
});

test('prompt builder considera quantidade de aulas na duração total', () => {
  const prompt = buildLessonPlanPrompt({
    tema: 'Alexandre o Grande',
    nivelEnsino: 'Ensino Médio',
    serieAno: '2ª série',
    disciplina: 'História',
    duracaoMinutos: 50,
    quantidadeAulas: 4,
  });

  assert.match(prompt, /duração total de 200 minutos/);
  assert.match(prompt, /4 aula\(s\) de 50 minutos cada/);
  assert.match(prompt, /exatamente 4 itens em etapas/);
});

test('valida a soma das etapas com tolerância de 10% e mínimo de cinco minutos', () => {
  assert.equal(validateLessonPlanContent(validContent(), 50).success, true);
  assert.equal(validateLessonPlanContent({ ...validContent(), etapas: [
    { ...validContent().etapas[0], duracaoMinutos: 20 },
  ] }, 50).success, false);
});

test('rejeita sequência didática com aulas em blocos únicos', () => {
  const content = validContent();
  content.etapas = [
    {
      titulo: 'Aula 1 - Expansão',
      descricao: 'Atividade contínua de análise da expansão.',
      duracaoMinutos: 90,
      objetivosRelacionados: ['OBJ-1'],
      produtoDoEstudante: 'Mapa anotado',
    },
    {
      titulo: 'Aula 2 - Síntese',
      descricao: 'Atividade contínua de produção de síntese.',
      duracaoMinutos: 90,
      objetivosRelacionados: ['OBJ-2'],
      produtoDoEstudante: 'Síntese escrita',
    },
  ];

  const validation = validateLessonPlanContent(content, 180, {
    quantidadeAulas: 2,
    duracaoPorAulaMinutos: 90,
  });

  assert.equal(validation.success, false);
  assert.match(
    validation.error.issues.map((issue) => issue.message).join(' '),
    /momentos internos|ultrapassar 35/
  );
});

test('aceita sequência didática com momentos internos por aula', () => {
  const content = validContent();
  content.etapas = [
    {
      aulaNumero: 1,
      titulo: 'Aula 1 - Investigação',
      descricao: 'Aula com momentos internos de investigação.',
      duracaoMinutos: 90,
      objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
      produtoDoEstudante: 'Registro de análise e síntese individual',
      momentos: [
        {
          tipo: 'abertura',
          duracaoMinutos: 10,
          descricao: 'Retomada e problematização.',
          acaoProfessor: 'Apresenta a pergunta orientadora.',
          acaoEstudantes: 'Registram hipótese inicial.',
          material: 'Quadro.',
          evidenciaProduzida: 'Hipótese registrada.',
        },
        {
          tipo: 'investigação',
          duracaoMinutos: 30,
          descricao: 'Análise de mapa e texto.',
          acaoProfessor: 'Orienta a análise dos materiais.',
          acaoEstudantes: 'Analisam evidências em duplas.',
          material: 'Mapa e texto curto.',
          evidenciaProduzida: 'Registro de análise.',
        },
        {
          tipo: 'produção',
          duracaoMinutos: 30,
          descricao: 'Produção de resposta argumentativa.',
          acaoProfessor: 'Solicita justificativas com evidências.',
          acaoEstudantes: 'Produzem uma resposta argumentativa.',
          material: 'Roteiro de resposta.',
          evidenciaProduzida: 'Resposta argumentativa.',
        },
        {
          tipo: 'fechamento',
          duracaoMinutos: 20,
          descricao: 'Síntese e avaliação formativa.',
          acaoProfessor: 'Retoma critérios de sucesso.',
          acaoEstudantes: 'Respondem ao bilhete de saída.',
          material: 'Bilhete de saída.',
          evidenciaProduzida: 'Bilhete de saída respondido.',
        },
      ],
    },
  ];

  assert.equal(validateLessonPlanContent(content, 90, {
    quantidadeAulas: 1,
    duracaoPorAulaMinutos: 90,
  }).success, true);
});

test('rejeita objetivos sem vínculos completos e referências inexistentes', () => {
  const content = validContent();
  content.etapas[0].objetivosRelacionados = ['OBJ-99'];
  content.avaliacoes[0].objetivosRelacionados = ['OBJ-1'];

  const validation = validateLessonPlanContent(content, 50);

  assert.equal(validation.success, false);
  assert.match(
    validation.error.issues.map((issue) => issue.message).join(' '),
    /OBJ-99 não existe|OBJ-2 deve estar associado/
  );
});

test('aceita somente códigos BNCC recuperados', () => {
  const content = validContent();
  content.habilidadesBNCC = [{ codigo: 'EF05CI01', descricao: 'Habilidade recuperada' }];

  assert.equal(validateLessonPlanContent(content, 50, {
    allowedBnccCodes: ['EF05CI01'],
  }).success, true);
  assert.equal(validateLessonPlanContent(content, 50, {
    allowedBnccCodes: ['EF05HI01'],
  }).success, false);
  assert.equal(validateLessonPlanContent(content, 50, {
    allowedBnccCodes: [],
  }).success, false);
});

test('rejeita o contrato legado com objetivos e avaliação em texto', () => {
  const content = validContent();
  content.objetivos = ['Compreender o conteúdo'];
  content.avaliacao = ['Participação'];
  delete content.avaliacoes;

  assert.equal(validateLessonPlanContent(content, 50).success, false);
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
