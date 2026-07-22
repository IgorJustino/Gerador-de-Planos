const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
const {
  calculateLessonPlanQuality,
} = require('../../src/services/lessonPlanQualityService');
const { createLessonPlanService } = require('../../src/services/lessonPlanService');

function lowQualityContent() {
  const content = createValidLessonPlanContent();
  content.objetivos = content.objetivos.map((objective) => ({
    ...objective,
    descricao: 'Compreender o conteúdo apresentado',
    evidencia: 'Participação',
    criterioSucesso: 'Participação geral',
  }));
  content.etapas = content.etapas.map((step) => ({
    ...step,
    descricao: 'Aula expositiva sobre o conteúdo planejado.',
    produtoDoEstudante: 'Anotações',
  }));
  content.avaliacoes = content.avaliacoes.map((assessment) => ({
    ...assessment,
    instrumento: 'Participação',
    criterioSucesso: 'Participação geral',
  }));
  content.adaptacoes = ['Apoio quando necessário'];
  return content;
}

function repositoryCapturing(saved) {
  return {
    async createLessonPlan(_db, input) {
      saved.push(input);
      return {
        id: 'plan-1',
        tema: input.tema,
        nivel_ensino: input.nivelEnsino,
        duracao_minutos: input.duracaoMinutos,
        codigo_bncc: input.codigoBNCC,
        status: input.status,
        content: input.content,
        current_version: 1,
        ai_model: input.aiModel,
        prompt_version: input.promptVersion,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
    },
  };
}

function generationInput() {
  return {
    tema: 'Fotossíntese',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
  };
}

function historicallyRiskyAlexanderContent() {
  const content = createValidLessonPlanContent({
    titulo: 'Alexandre, o Grande: O Arquiteto do Mundo Ocidental',
    resumo: 'Plano sobre como Alexandre foi o principal ator a moldar o Ocidente.',
  });
  content.objetivos = [
    {
      id: 'OBJ-1',
      descricao: 'Identificar ações estratégicas de Alexandre na formação do mundo helenístico',
      evidencia: 'Mapa mental com exemplos históricos',
      criterioSucesso: 'Inclui ao menos três ações e registra uma consequência',
    },
    {
      id: 'OBJ-2',
      descricao: 'Elaborar hipótese contrafactual sobre a expansão de Alexandre',
      evidencia: 'Texto argumentativo individual',
      criterioSucesso: 'Apresenta dois argumentos coerentes com evidências',
    },
  ];
  content.etapas = [
    {
      titulo: 'Mapa mental',
      descricao: 'Os estudantes analisam a atuação de Alexandre e registram relações com o mundo ocidental.',
      duracaoMinutos: 40,
      objetivosRelacionados: ['OBJ-1'],
      produtoDoEstudante: 'Mapa mental com ações estratégicas',
    },
    {
      titulo: 'Contrafactual',
      descricao: 'Em grupos, respondem: como seria o mundo se Alexandre tivesse avançado para a Ásia Central em vez de retornar?',
      duracaoMinutos: 60,
      objetivosRelacionados: ['OBJ-2'],
      produtoDoEstudante: 'Hipótese contrafactual em texto',
    },
    {
      titulo: 'Síntese',
      descricao: 'Cada estudante explica uma consequência da expansão de Alexandre.',
      duracaoMinutos: 20,
      objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
      produtoDoEstudante: 'Resposta individual de síntese',
    },
  ];
  content.avaliacoes = [
    {
      instrumento: 'Mapa mental e texto contrafactual',
      objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
      criterioSucesso: 'Apresenta dois argumentos coerentes com evidências',
    },
  ];
  return content;
}

function multiLessonSteps(lessonCount = 4) {
  return Array.from({ length: lessonCount }, (_unused, index) => {
    const aulaNumero = index + 1;
    return {
      aulaNumero,
      titulo: `Aula ${aulaNumero} - Investigação orientada`,
      descricao: 'Aula organizada em momentos internos com abertura, investigação, produção e fechamento.',
      duracaoMinutos: 90,
      objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
      produtoDoEstudante: 'Registro de análise e resposta individual avaliativa',
      momentos: [
        {
          tipo: 'abertura',
          duracaoMinutos: 10,
          descricao: 'Abertura com retomada e problematização inicial.',
          acaoProfessor: 'Apresenta a questão-problema e recupera conhecimentos prévios.',
          acaoEstudantes: 'Registram uma hipótese inicial.',
          material: 'Quadro e pergunta orientadora.',
          evidenciaProduzida: 'Pergunta inicial registrada.',
        },
        {
          tipo: 'investigação',
          duracaoMinutos: 30,
          descricao: 'Análise de evidências com registro de conclusões.',
          acaoProfessor: 'Distribui materiais e orienta a leitura das evidências.',
          acaoEstudantes: 'Analisam as evidências em duplas.',
          material: 'Mapa e texto curto.',
          evidenciaProduzida: 'Registro de análise.',
        },
        {
          tipo: 'produção',
          duracaoMinutos: 30,
          descricao: 'Produção de síntese argumentativa com evidências.',
          acaoProfessor: 'Acompanha a produção e solicita justificativas.',
          acaoEstudantes: 'Produzem síntese argumentativa.',
          material: 'Roteiro de resposta.',
          evidenciaProduzida: 'Síntese argumentativa.',
        },
        {
          tipo: 'fechamento',
          duracaoMinutos: 20,
          descricao: 'Fechamento com avaliação formativa individual.',
          acaoProfessor: 'Recolhe respostas e retoma critérios de sucesso.',
          acaoEstudantes: 'Respondem individualmente a uma pergunta de síntese.',
          material: 'Bilhete de saída.',
          evidenciaProduzida: 'Resposta individual avaliativa.',
        },
      ],
    };
  });
}

function blockedMultiLessonContent() {
  return createValidLessonPlanContent({
    etapas: [
      {
        titulo: 'Aula 1 - Expansão',
        descricao: 'Os estudantes analisam evidências da expansão em uma atividade contínua.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-1'],
        produtoDoEstudante: 'Mapa anotado',
      },
      {
        titulo: 'Aula 2 - Produção',
        descricao: 'Os estudantes produzem síntese argumentativa em uma atividade contínua.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-2'],
        produtoDoEstudante: 'Síntese argumentativa',
      },
      {
        titulo: 'Aula 3 - Debate',
        descricao: 'Os estudantes debatem hipóteses e registram argumentos.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
        produtoDoEstudante: 'Registro de debate',
      },
      {
        titulo: 'Aula 4 - Avaliação',
        descricao: 'Os estudantes concluem o percurso com avaliação individual.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
        produtoDoEstudante: 'Resposta individual',
      },
    ],
  });
}

test('pontuação diferencia plano verificável de esqueleto genérico', () => {
  const strong = calculateLessonPlanQuality(createValidLessonPlanContent(), 50);
  const weak = calculateLessonPlanQuality(lowQualityContent(), 50);

  assert.equal(strong.pontuacao, 100);
  assert.equal(strong.aprovado, true);
  assert.equal(weak.aprovado, false);
  assert.ok(weak.pontuacao < weak.limiteAprovacao);
  assert.ok(weak.criterios.some(
    (criterion) => criterion.id === 'aprendizagem_ativa' && !criterion.atendido
  ));
});

test('pontuação penaliza risco factual histórico e contrafactual incorreto', () => {
  const report = calculateLessonPlanQuality(historicallyRiskyAlexanderContent(), 120);

  assert.equal(report.aprovado, false);
  assert.ok(report.pontuacao <= 70);
  const historicalCriterion = report.criterios.find((criterion) => (
    criterion.id === 'rigor_factual_historico'
  ));
  assert.equal(historicalCriterion.atendido, false);
  assert.match(historicalCriterion.detalhe, /Ásia Central|Asia Central|Ocidente/);
});

test('pontuação reconhece avaliar como objetivo observável', () => {
  const content = createValidLessonPlanContent();
  content.objetivos[0].descricao = 'Avaliar a hipótese histórica com base em evidências';

  const report = calculateLessonPlanQuality(content, 50);
  const objectiveCriterion = report.criterios.find((criterion) => (
    criterion.id === 'objetivos_observaveis'
  ));

  assert.equal(objectiveCriterion.pontos, 10);
});

test('pontuação reconhece formas conjugadas de ações observáveis', () => {
  const content = createValidLessonPlanContent();
  content.objetivos[0].descricao = 'Analisa os elementos necessários para a fotossíntese';
  content.objetivos[1].descricao = 'Calcula a variação de energia no processo';

  const report = calculateLessonPlanQuality(content, 50);
  const objectiveCriterion = report.criterios.find((criterion) => (
    criterion.id === 'objetivos_observaveis'
  ));

  assert.equal(objectiveCriterion.pontos, 10);
});

test('usa narrativas antigas posteriores sem tratá-las como risco anacrônico', () => {
  const content = createValidLessonPlanContent({
    titulo: 'Alexandre e o mundo helenístico',
    resumo: 'Plano sobre Alexandria, estruturas persas e Gaugamela, considerando limites e conflitos do processo helenístico.',
    recursos: ['Narrativas antigas posteriores sobre Alexandre', 'Mapa histórico'],
  });

  const report = calculateLessonPlanQuality(content, 50);
  const historicalCriterion = report.criterios.find((criterion) => (
    criterion.id === 'rigor_factual_historico'
  ));

  assert.equal(historicalCriterion.pontos, 10);
  assert.doesNotMatch(historicalCriterion.detalhe, /vagos ou anacrônicos/);
});

test('limita consistência histórica sem contexto factual recuperado', () => {
  const content = createValidLessonPlanContent({
    titulo: 'Alexandre e o mundo helenístico',
    resumo: 'Plano sobre Alexandria, estruturas persas, Gaugamela e os limites do helenismo.',
  });

  const withoutContext = calculateLessonPlanQuality(content, 50);
  const withContext = calculateLessonPlanQuality(content, 50, {
    contextoFactualRecuperado: true,
  });

  assert.equal(withoutContext.criterios.find((criterion) => criterion.id === 'rigor_factual_historico').pontos, 10);
  assert.equal(withContext.criterios.find((criterion) => criterion.id === 'rigor_factual_historico').pontos, 15);
});

test('penaliza categoria histórica que mistura centros de poder e batalha', () => {
  const content = createValidLessonPlanContent({
    titulo: 'Alexandre e o mundo helenístico',
    resumo: 'Plano sobre Alexandria, estruturas persas, Gaugamela e os limites do helenismo.',
  });
  content.objetivos[0].criterioSucesso = 'Adequado: identifica 3 centros de poder: Susa, Alexandria e Gaugamela; parcial: identifica 2; insuficiente: não identifica centros.';

  const report = calculateLessonPlanQuality(content, 50, {
    contextoFactualRecuperado: true,
  });
  const historicalCriterion = report.criterios.find((criterion) => (
    criterion.id === 'rigor_factual_historico'
  ));

  assert.equal(historicalCriterion.pontos, 10);
  assert.match(historicalCriterion.detalhe, /batalhas ou pontos de campanha/);
});

test('penaliza conclusão de inviabilidade em vez de investigação dos limites', () => {
  const content = createValidLessonPlanContent({
    titulo: 'Alexandre e os limites da expansão',
    resumo: 'Plano histórico sobre Alexandria, Gaugamela e o vale do Indo, investigando limites logísticos, militares e políticos da campanha.',
  });
  content.etapas[1].descricao = 'Síntese sobre a inviabilidade logística da continuidade da campanha.';

  const report = calculateLessonPlanQuality(content, 50, {
    contextoFactualRecuperado: true,
  });
  const historicalCriterion = report.criterios.find((criterion) => (
    criterion.id === 'rigor_factual_historico'
  ));

  assert.equal(historicalCriterion.pontos, 10);
  assert.match(historicalCriterion.detalhe, /inviabilidade da continuidade/);
});

test('pontuação penaliza sequência com aulas em blocos únicos', () => {
  const content = createValidLessonPlanContent({
    etapas: [
      {
        titulo: 'Aula 1 - Expansão',
        descricao: 'Os estudantes analisam mapa e discutem hipóteses em uma atividade contínua.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-1'],
        produtoDoEstudante: 'Mapa anotado',
      },
      {
        titulo: 'Aula 2 - Produção',
        descricao: 'Os estudantes produzem síntese argumentativa com evidências.',
        duracaoMinutos: 90,
        objetivosRelacionados: ['OBJ-2'],
        produtoDoEstudante: 'Síntese argumentativa',
      },
    ],
  });

  const report = calculateLessonPlanQuality(content, 180);
  const sequenceCriterion = report.criterios.find((criterion) => (
    criterion.id === 'coerencia_sequencia_aulas'
  ));

  assert.equal(sequenceCriterion.pontos, 0);
  assert.equal(sequenceCriterion.maximo, 5);
  assert.equal(sequenceCriterion.atendido, false);
});

test('pontuação penaliza critérios de avaliação vagos mesmo com níveis', () => {
  const content = createValidLessonPlanContent();
  content.avaliacoes = [{
    instrumento: 'Ensaio argumentativo',
    objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
    criterioSucesso: 'Adequado: demonstra compreensão. Parcial: argumentação fraca. Insuficiente: fantasioso.',
  }];

  const report = calculateLessonPlanQuality(content, 50);
  const assessmentCriterion = report.criterios.find((criterion) => (
    criterion.id === 'criterios_avaliacao'
  ));

  assert.equal(assessmentCriterion.pontos, 0);
  assert.equal(assessmentCriterion.atendido, false);
});

test('pontuação limita critério quando ensaio final não avalia todos os objetivos', () => {
  const content = createValidLessonPlanContent();
  content.avaliacoes = [{
    instrumento: 'Ensaio final',
    objetivosRelacionados: ['OBJ-1'],
    criterioSucesso: 'Adequado: usa duas evidências; parcial: usa uma evidência; insuficiente: não usa evidências.',
  }];

  const report = calculateLessonPlanQuality(content, 50);
  const assessmentCriterion = report.criterios.find((criterion) => (
    criterion.id === 'criterios_avaliacao'
  ));

  assert.equal(assessmentCriterion.pontos, 6);
});

test('ensaio final mensurável pode cobrir explicitamente os três objetivos', () => {
  const content = createValidLessonPlanContent();
  content.objetivos.push({
    id: 'OBJ-3',
    descricao: 'Comparar duas explicações sobre o processo',
    evidencia: 'Quadro comparativo individual',
    criterioSucesso: 'Compara corretamente duas explicações e registra uma diferença',
  });
  content.avaliacoes = [{
    instrumento: 'Ensaio final',
    objetivosRelacionados: ['OBJ-1', 'OBJ-2', 'OBJ-3'],
    criterioSucesso: 'Adequado: utiliza ao menos três evidências, analisa uma estratégia, apresenta um contraponto e formula uma hipótese; parcial: utiliza duas evidências e atende a duas condições; insuficiente: utiliza uma ou nenhuma evidência e não atende às condições.',
  }];

  const report = calculateLessonPlanQuality(content, 50);
  const assessmentCriterion = report.criterios.find((criterion) => (
    criterion.id === 'criterios_avaliacao'
  ));

  assert.equal(assessmentCriterion.pontos, 10);
});

test('pontuação fica indisponível para plano no contrato legado', () => {
  const report = calculateLessonPlanQuality({ objetivos: ['Objetivo antigo'] }, 50);

  assert.equal(report.disponivel, false);
  assert.equal(report.pontuacao, null);
});

test('qualidade insuficiente dispara uma revisão e salva a melhor resposta', async () => {
  const saved = [];
  const prompts = [];
  const service = createLessonPlanService({
    db: {},
    env: { aiQualityMinScore: 80, aiQualityReviewEnabled: true },
    geminiService: {
      async generateStructuredLessonPlan({ prompt, allowedBnccCodes }) {
        prompts.push(prompt);
        assert.deepEqual(allowedBnccCodes, []);
        return {
          content: prompts.length === 1 ? lowQualityContent() : createValidLessonPlanContent(),
          model: 'test-model',
          promptVersion: 'lesson-plan-v2',
        };
      },
    },
    repository: repositoryCapturing(saved),
  });

  const plan = await service.generateLessonPlan({ userId: 'user-1', input: generationInput() });

  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /TAREFA DE REVISÃO/);
  assert.match(prompts[1], /Aprendizagem ativa/);
  assert.deepEqual(saved[0].content, createValidLessonPlanContent());
  assert.equal(plan.qualidade.pontuacao, 100);
});

test('plano aprovado não consome uma segunda chamada', async () => {
  const saved = [];
  let calls = 0;
  const service = createLessonPlanService({
    db: {},
    env: { aiQualityMinScore: 80, aiQualityReviewEnabled: true },
    geminiService: {
      async generateStructuredLessonPlan() {
        calls += 1;
        return { content: createValidLessonPlanContent(), model: 'test-model' };
      },
    },
    repository: repositoryCapturing(saved),
  });

  await service.generateLessonPlan({ userId: 'user-1', input: generationInput() });

  assert.equal(calls, 1);
  assert.equal(saved.length, 1);
});

test('geração com várias aulas salva a duração total do plano', async () => {
  const saved = [];
  const service = createLessonPlanService({
    db: {},
    env: { aiQualityMinScore: 80, aiQualityReviewEnabled: true },
    geminiService: {
      async generateStructuredLessonPlan({ expectedDurationMinutes }) {
        assert.equal(expectedDurationMinutes, 360);
        return {
          content: createValidLessonPlanContent({
            etapas: multiLessonSteps(4),
          }),
          model: 'test-model',
        };
      },
    },
    repository: repositoryCapturing(saved),
  });

  await service.generateLessonPlan({
    userId: 'user-1',
    input: { ...generationInput(), duracaoMinutos: 90, quantidadeAulas: 4 },
  });

  assert.equal(saved[0].duracaoMinutos, 360);
});

test('sequência em blocos únicos dispara revisão sem erro fatal', async () => {
  const saved = [];
  let calls = 0;
  const service = createLessonPlanService({
    db: {},
    env: { aiQualityMinScore: 80, aiQualityReviewEnabled: true },
    geminiService: {
      async generateStructuredLessonPlan() {
        calls += 1;
        return {
          content: calls === 1
            ? blockedMultiLessonContent()
            : createValidLessonPlanContent({ etapas: multiLessonSteps(4) }),
          model: 'test-model',
        };
      },
    },
    repository: repositoryCapturing(saved),
  });

  const plan = await service.generateLessonPlan({
    userId: 'user-1',
    input: { ...generationInput(), duracaoMinutos: 90, quantidadeAulas: 4 },
  });

  assert.equal(calls, 2);
  assert.equal(saved[0].content.etapas.length, 4);
  assert.equal(saved[0].content.etapas[0].momentos.length, 4);
  assert.equal(plan.qualidade.aprovado, true);
});

test('falha da revisão preserva o primeiro plano estruturalmente válido', async () => {
  const saved = [];
  let calls = 0;
  const firstContent = lowQualityContent();
  const service = createLessonPlanService({
    db: {},
    env: { aiQualityMinScore: 80, aiQualityReviewEnabled: true },
    geminiService: {
      async generateStructuredLessonPlan() {
        calls += 1;
        if (calls === 2) throw new Error('revisão indisponível');
        return { content: firstContent, model: 'test-model' };
      },
    },
    repository: repositoryCapturing(saved),
  });

  const plan = await service.generateLessonPlan({ userId: 'user-1', input: generationInput() });

  assert.equal(calls, 2);
  assert.deepEqual(saved[0].content, firstContent);
  assert.equal(plan.qualidade.aprovado, false);
});
