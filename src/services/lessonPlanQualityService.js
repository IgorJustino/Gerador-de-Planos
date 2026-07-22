const { geminiLessonPlanSchema } = require('../schemas/geminiSchemas');

const DEFAULT_QUALITY_THRESHOLD = 80;

const OBSERVABLE_ACTIONS = [
  'analisar', 'aplicar', 'argumentar', 'calcular', 'classificar', 'comparar',
  'construir', 'criar', 'demonstrar', 'descrever', 'distinguir', 'elaborar',
  'estimar', 'avaliar', 'formular', 'explicar', 'identificar', 'interpretar',
  'justificar', 'localizar', 'produzir', 'registrar', 'relacionar', 'resolver',
  'sintetizar',
];

const OBSERVABLE_ACTION_FORMS = [
  ...OBSERVABLE_ACTIONS,
  'analisa', 'aplica', 'argumenta', 'calcula', 'classifica', 'compara',
  'constroi', 'cria', 'demonstra', 'descreve', 'distingue', 'elabora',
  'estima', 'avalia', 'formula', 'explica', 'identifica', 'interpreta',
  'justifica', 'localiza', 'produz', 'registra', 'relaciona', 'resolve',
  'sintetiza',
];

const ACTIVE_LEARNING_ACTIONS = [
  'analis', 'argument', 'classific', 'compar', 'constru', 'cri', 'debat',
  'elabor', 'explic', 'identific', 'investig', 'localiz', 'produz', 'registr',
  'relacion', 'resolv', 'sintetiz',
];

const MEASURABLE_MARKERS = [
  'ao menos', 'corretamente', 'distingue', 'explica', 'identifica', 'inclui',
  'justifica', 'localiza', 'menciona', 'registra', 'relaciona', 'compara',
  'apresenta', 'atende', 'adequado', 'parcial', 'insuficiente', 'evidencia',
];

const ADAPTATION_ACTIONS = [
  'ampli', 'disponibiliz', 'fornec', 'oferec', 'organiz', 'permit', 'utiliz',
];

const ACCESS_MARKERS = [
  'audio', 'contraste', 'dupla', 'fonte', 'imagem', 'leitor', 'oral', 'tempo',
  'text', 'visual', 'tatil', 'modelo', 'roteiro', 'glossario', 'instrucoes',
];

const GENERIC_EVIDENCE = new Set([
  'atividade', 'atividade final', 'avaliacao', 'discussao', 'observacao',
  'participacao', 'resposta', 'trabalho',
]);

const VAGUE_ASSESSMENT_CRITERIA = [
  'demonstracao de compreensao', 'capacidade de sustentar hipoteses',
  'participacao geral', 'bom desempenho', 'compreensao do conteudo',
  'compreensao superficial', 'argumentacao fraca', 'fantasioso',
  'demonstra compreensao', 'integra as dimensoes', 'contrapontos historiograficos',
];

const ALEXANDER_MARKERS = ['alexandre', 'macedonia', 'helenistico'];
const HISTORICAL_MARKERS = [
  ...ALEXANDER_MARKERS,
  'historia', 'historico', 'revolucao francesa', 'imperio', 'antiguidade',
  'colonizacao', 'escravidao', 'republica romana',
];
const ALEXANDER_CONCRETE_EXAMPLES = [
  'alexandria', 'persa', 'persas', 'susa', 'gaugamela', 'isso', 'egito',
  'indo', 'hifase', 'hyphasis', 'asia central', 'diadocos', 'helenistico',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(value, terms) {
  const normalized = normalizeText(value);
  return terms.some((term) => normalized.includes(term));
}

function hasObservableAction(value) {
  return containsAny(value, OBSERVABLE_ACTION_FORMS);
}

function isSpecific(value) {
  const normalized = normalizeText(value);
  return normalized.length >= 12 && !GENERIC_EVIDENCE.has(normalized);
}

function isMeasurable(value) {
  const normalized = normalizeText(value);
  return /\d/.test(normalized) || MEASURABLE_MARKERS.some((term) => normalized.includes(term));
}

function ratioScore(items, predicate, maximum) {
  if (items.length === 0) return 0;
  const matches = items.filter(predicate).length;
  return Math.round((matches / items.length) * maximum);
}

function qualityCriterion(id, titulo, pontos, maximo, detalhe) {
  return {
    id,
    titulo,
    pontos,
    maximo,
    atendido: pontos === maximo,
    detalhe,
  };
}

function countMatches(value, terms) {
  const normalized = normalizeText(value);
  return terms.filter((term) => normalized.includes(term)).length;
}

function hasLessonMoments(step) {
  return Array.isArray(step.momentos) && step.momentos.length >= 3 && step.momentos.length <= 6;
}

function momentsDuration(step) {
  return (step.momentos || []).reduce((sum, moment) => sum + Number(moment.duracaoMinutos || 0), 0);
}

function hasPerformanceLevels(value) {
  const normalized = normalizeText(value);
  return (
    normalized.includes('adequado')
    && normalized.includes('parcial')
    && normalized.includes('insuficiente')
  );
}

function isAssessmentCriterionMeasurable(value) {
  const normalized = normalizeText(value);
  if (VAGUE_ASSESSMENT_CRITERIA.some((term) => normalized.includes(term))) return false;
  if (!hasPerformanceLevels(normalized)) return false;

  const hasQuantityOrCondition = /\d/.test(normalized)
    || /\b(uma|um|duas|dois|tres|três|pelo menos|ao menos)\b/.test(normalized)
    || containsAny(normalized, [
      'identifica', 'utiliza', 'usa', 'relaciona', 'explica', 'justifica',
      'compara', 'localiza', 'registra', 'formula', 'distingue', 'menciona',
      'inclui', 'responde',
    ]);

  return hasQuantityOrCondition;
}

function joinPlanText(plan) {
  return [
    plan.titulo,
    plan.resumo,
    ...plan.metodologia,
    ...plan.recursos,
    ...plan.objetivos.flatMap((objective) => [
      objective.descricao,
      objective.evidencia,
      objective.criterioSucesso,
    ]),
    ...plan.etapas.flatMap((step) => [
      step.titulo,
      step.descricao,
      step.produtoDoEstudante,
      ...(step.momentos || []).flatMap((moment) => [
        moment.tipo,
        moment.descricao,
        moment.acaoProfessor,
        moment.acaoEstudantes,
        moment.material,
        moment.evidenciaProduzida,
      ]),
    ]),
    ...plan.avaliacoes.flatMap((assessment) => [
      assessment.instrumento,
      assessment.criterioSucesso,
    ]),
    ...plan.adaptacoes,
  ].join(' ');
}

function isHistoricalPlan(plan) {
  return containsAny(joinPlanText(plan), HISTORICAL_MARKERS);
}

function findCategoryMismatchIssues(plan) {
  const fields = [
    ...plan.objetivos.flatMap((objective) => [
      objective.descricao,
      objective.criterioSucesso,
      objective.evidencia,
    ]),
    ...plan.etapas.flatMap((step) => [step.titulo, step.descricao, step.produtoDoEstudante]),
    ...plan.avaliacoes.flatMap((assessment) => [assessment.instrumento, assessment.criterioSucesso]),
  ].map(normalizeText);

  const categoryRules = [
    {
      category: /centros? de (poder|administracao|controle)|cidades? administrativas/,
      incompatible: /gaugamela|isso|hifase|hyphasis/,
      message: 'O plano classifica batalhas ou pontos de campanha como centros de poder ou administrativos.',
    },
    {
      category: /cidades? (fundadas|construidas|administrativas)/,
      incompatible: /gaugamela|isso|hifase|hyphasis/,
      message: 'O plano classifica batalhas ou pontos de campanha como cidades.',
    },
  ];

  return categoryRules
    .filter((rule) => fields.some((field) => rule.category.test(field) && rule.incompatible.test(field)))
    .map((rule) => rule.message);
}

function findHistoricalRiskIssues(plan, expectedDurationMinutes) {
  const issues = [];
  const title = normalizeText(plan.titulo);
  const fullText = normalizeText(joinPlanText(plan));
  const isAlexanderPlan = containsAny(fullText, ALEXANDER_MARKERS);

  if (/arquiteto do mundo ocidental|moldou o ocidente|moldar o ocidente|principal ator a moldar/.test(fullText)) {
    issues.push('Afirmação causal ampla sobre o Ocidente tratada como conclusão factual.');
  }

  if (/arquiteto do mundo ocidental|criador do mundo ocidental|pai do mundo ocidental/.test(title)) {
    issues.push('Título apresenta interpretação controversa como conclusão definitiva.');
  }

  if (
    isAlexanderPlan
    && /asia central/.test(fullText)
    && /(em vez de retornar|se tivesse avancado|se alexandre tivesse avancado)/.test(fullText)
  ) {
    issues.push('Contrafactual sugere que Alexandre não avançou pela Ásia Central, evento que ocorreu historicamente.');
  }

  if (isAlexanderPlan && countMatches(fullText, ALEXANDER_CONCRETE_EXAMPLES) < 3) {
    issues.push('Plano sobre Alexandre usa poucos exemplos históricos concretos.');
  }

  if (isAlexanderPlan && /jornais historicos|jornal historico|relatos de epoca/.test(fullText)) {
    issues.push('Materiais históricos vagos ou anacrônicos para o período de Alexandre.');
  }

  if (isHistoricalPlan(plan) && /inviabilidade|inviavel|inviável/.test(fullText)) {
    issues.push('O plano apresenta a inviabilidade da continuidade como conclusão, em vez de investigar seus limites.');
  }

  issues.push(...findCategoryMismatchIssues(plan));

  const hasCounterpoint = /limite|contraponto|controvers|resistencia|conflito|dominacao|hipotese|interpretacao/.test(fullText);
  if (isAlexanderPlan && !hasCounterpoint) {
    issues.push('Plano histórico não apresenta contraponto ou limite para a interpretação central.');
  }

  const largeBlocks = plan.etapas.some((step) => (
    expectedDurationMinutes >= 50 && step.duracaoMinutos >= Math.max(35, expectedDurationMinutes * 0.45)
  ));
  if (expectedDurationMinutes >= 50 && plan.etapas.length <= 3 && largeBlocks) {
    issues.push('Distribuição do tempo concentra a aula em poucos blocos grandes.');
  }

  return issues;
}

function calculateHistoricalScore(issues, { historicalPlan = false, factualContextRecovered = false } = {}) {
  const score = Math.max(0, 15 - Math.min(15, issues.length * 5));
  if (historicalPlan && !factualContextRecovered) return Math.min(score, 10);
  return score;
}

function calculateSequenceScore(plan, expectedDurationMinutes) {
  if (expectedDurationMinutes < 80) return 5;
  const lessonsWithMoments = plan.etapas.filter(hasLessonMoments);
  if (lessonsWithMoments.length > 0) {
    const everyLessonHasMoments = lessonsWithMoments.length === plan.etapas.length;
    const momentsFitDuration = plan.etapas.every((step) => (
      hasLessonMoments(step) && momentsDuration(step) === step.duracaoMinutos
    ));
    const noLongMoment = plan.etapas.every((step) => (
      !hasLessonMoments(step) || step.momentos.every((moment) => moment.duracaoMinutos <= 35)
    ));
    const everyLessonHasOpeningAndClosure = plan.etapas.every((step) => {
      if (!hasLessonMoments(step)) return false;
      const text = normalizeText(step.momentos.map((moment) => `${moment.tipo} ${moment.descricao}`).join(' '));
      return /abertura|retomada|problematiza/.test(text) && /fechamento|sintese|avaliacao/.test(text);
    });
    if (everyLessonHasMoments && momentsFitDuration && noLongMoment && everyLessonHasOpeningAndClosure) return 5;
    if (everyLessonHasMoments && momentsFitDuration) return 4;
    return 2;
  }

  const hasLongStep = plan.etapas.some((step) => step.duracaoMinutos > 35);
  const hasAulaMarkers = plan.etapas.some((step) => /aula\s+\d+/i.test(step.titulo + step.descricao));
  const hasEnoughMoments = plan.etapas.length >= Math.min(4, Math.ceil(expectedDurationMinutes / 90) * 3);
  const hasClosure = plan.etapas.some((step) => /fechamento|sintese|síntese|avaliacao|avaliação/.test(normalizeText(step.titulo + step.descricao)));
  if (!hasLongStep && hasAulaMarkers && hasEnoughMoments && hasClosure) return 5;
  if (!hasLongStep && hasEnoughMoments) return 3;
  return 0;
}

function finalAssessmentCoversAllObjectives(plan) {
  const finalAssessments = plan.avaliacoes.filter((assessment) => (
    /ensaio|produto final|avaliacao final|avaliação final|sintese final|síntese final/.test(
      normalizeText(assessment.instrumento)
    )
  ));
  if (finalAssessments.length === 0) return true;
  const objectiveIds = new Set(plan.objetivos.map((objective) => objective.id));
  return finalAssessments.some((assessment) => {
    const related = new Set(assessment.objetivosRelacionados || []);
    return [...objectiveIds].every((objectiveId) => related.has(objectiveId));
  });
}

function unavailableQualityReport(threshold) {
  return {
    disponivel: false,
    pontuacao: null,
    limiteAprovacao: threshold,
    aprovado: false,
    criterios: [],
  };
}

function calculateLessonPlanQuality(content, expectedDurationMinutes, options = {}) {
  const threshold = Number.isInteger(options.threshold)
    ? Math.min(Math.max(options.threshold, 0), 100)
    : DEFAULT_QUALITY_THRESHOLD;
  const parsed = geminiLessonPlanSchema.safeParse(content);
  if (!parsed.success) return unavailableQualityReport(threshold);

  const plan = parsed.data;
  const objectiveDescriptions = plan.objetivos.map((item) => item.descricao);
  const objectiveEvidence = plan.objetivos.map((item) => item.evidencia);
  const objectiveCriteria = plan.objetivos.map((item) => item.criterioSucesso);
  const studentProducts = plan.etapas.map((item) => item.produtoDoEstudante);
  const assessmentInstruments = plan.avaliacoes.map((item) => item.instrumento);
  const assessmentCriteria = plan.avaliacoes.map((item) => item.criterioSucesso);

  const observableScore = ratioScore(
    objectiveDescriptions,
    hasObservableAction,
    10
  );
  const evidenceScore = ratioScore(objectiveEvidence, isSpecific, 10);
  const objectiveCriteriaScore = ratioScore(objectiveCriteria, isMeasurable, 10);
  const activeLearningScore = plan.etapas.some(
    (step) => containsAny(step.descricao, ACTIVE_LEARNING_ACTIONS)
  ) ? 10 : 0;
  const productScore = ratioScore(studentProducts, isSpecific, 10);
  const instrumentScore = ratioScore(assessmentInstruments, isSpecific, 10);
  const rawAssessmentCriteriaScore = ratioScore(assessmentCriteria, isAssessmentCriterionMeasurable, 10);
  const assessmentCriteriaScore = finalAssessmentCoversAllObjectives(plan)
    ? rawAssessmentCriteriaScore
    : Math.min(rawAssessmentCriteriaScore, 6);
  const adaptationScore = ratioScore(
    plan.adaptacoes,
    (value) => containsAny(value, ADAPTATION_ACTIONS) && containsAny(value, ACCESS_MARKERS),
    5
  );
  const totalDuration = plan.etapas.reduce((sum, step) => sum + step.duracaoMinutos, 0);
  const durationDifference = Math.abs(totalDuration - expectedDurationMinutes);
  const durationScore = durationDifference === 0 ? 5 : durationDifference <= 5 ? 3 : 0;
  const historicalIssues = findHistoricalRiskIssues(plan, expectedDurationMinutes);
  const historicalScore = calculateHistoricalScore(historicalIssues, {
    historicalPlan: isHistoricalPlan(plan),
    factualContextRecovered: options.contextoFactualRecuperado === true,
  });
  const sequenceScore = calculateSequenceScore(plan, expectedDurationMinutes);

  const criteria = [
    qualityCriterion(
      'objetivos_observaveis',
      'Objetivos observáveis',
      observableScore,
      10,
      'Os objetivos devem usar ações que possam ser verificadas em sala.'
    ),
    qualityCriterion(
      'evidencias_especificas',
      'Evidências específicas',
      evidenceScore,
      10,
      'Cada objetivo deve indicar um produto ou registro concreto.'
    ),
    qualityCriterion(
      'criterios_objetivos',
      'Critérios mensuráveis dos objetivos',
      objectiveCriteriaScore,
      10,
      'Os critérios devem indicar o que caracteriza uma resposta satisfatória.'
    ),
    qualityCriterion(
      'aprendizagem_ativa',
      'Aprendizagem ativa',
      activeLearningScore,
      10,
      'Ao menos uma etapa deve exigir análise, produção, argumentação ou resolução.'
    ),
    qualityCriterion(
      'produtos_estudante',
      'Produtos dos estudantes',
      productScore,
      10,
      'As etapas devem produzir evidências concretas, não apenas participação.'
    ),
    qualityCriterion(
      'instrumentos_avaliacao',
      'Instrumentos de avaliação',
      instrumentScore,
      10,
      'Os instrumentos devem ser específicos e aplicáveis no tempo da aula.'
    ),
    qualityCriterion(
      'criterios_avaliacao',
      'Critérios de avaliação',
      assessmentCriteriaScore,
      10,
      'As avaliações devem declarar critérios verificáveis.'
    ),
    qualityCriterion(
      'adaptacoes_concretas',
      'Adaptações concretas',
      adaptationScore,
      5,
      'As adaptações devem indicar uma ação e um recurso de acesso ou participação.'
    ),
    qualityCriterion(
      'duracao',
      'Compatibilidade da duração',
      durationScore,
      5,
      `As etapas somam ${totalDuration} de ${expectedDurationMinutes} minutos.`
    ),
    qualityCriterion(
      'rigor_factual_historico',
      'Consistência histórica estrutural',
      historicalScore,
      15,
      historicalIssues.length === 0
        ? historicalScore < 15
          ? 'Nenhum risco histórico detectado pelas regras determinísticas, mas não há contexto factual recuperado. Não substitui verificação por fontes.'
          : 'Nenhum risco histórico detectado pelas regras determinísticas. Não substitui verificação por fontes.'
        : historicalIssues.join(' ')
    ),
    qualityCriterion(
      'coerencia_sequencia_aulas',
      'Coerência da sequência de aulas',
      sequenceScore,
      5,
      'Sequências com várias aulas devem ser divididas em momentos menores, com progressão e fechamento.'
    ),
  ];
  const rawScore = criteria.reduce((sum, criterion) => sum + criterion.pontos, 0);
  const hasBlockingSequenceIssue = expectedDurationMinutes >= 80 && sequenceScore === 0;
  const score = historicalScore === 0 || hasBlockingSequenceIssue ? Math.min(rawScore, 70) : rawScore;

  return {
    disponivel: true,
    pontuacao: score,
    limiteAprovacao: threshold,
    aprovado: score >= threshold && historicalScore > 0 && !hasBlockingSequenceIssue,
    criterios: criteria,
  };
}

module.exports = {
  DEFAULT_QUALITY_THRESHOLD,
  calculateLessonPlanQuality,
  normalizeText,
};
