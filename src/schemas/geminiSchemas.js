const { z } = require('zod');

const boundedString = (min, max) => z.string().trim().min(min).max(max);
const objectiveIdSchema = z.string().trim().regex(
  /^OBJ-[1-9]\d{0,2}$/,
  'O identificador deve seguir o formato OBJ-1'
);

const lessonObjectiveSchema = z.object({
  id: objectiveIdSchema,
  descricao: boundedString(5, 500),
  evidencia: boundedString(3, 500),
  criterioSucesso: boundedString(3, 500),
}).strict();

const relatedObjectiveIdsSchema = z.array(objectiveIdSchema).min(1).max(10);

const lessonMomentSchema = z.object({
  tipo: boundedString(2, 80),
  duracaoMinutos: z.number().int().positive().max(120),
  descricao: boundedString(5, 800),
  acaoProfessor: boundedString(3, 500),
  acaoEstudantes: boundedString(3, 500),
  material: boundedString(2, 300),
  evidenciaProduzida: boundedString(3, 500),
}).strict();

const lessonStepSchema = z.object({
  aulaNumero: z.number().int().min(1).max(20).optional(),
  momento: boundedString(2, 80).optional(),
  titulo: boundedString(2, 200),
  descricao: boundedString(5, 1500),
  duracaoMinutos: z.number().int().positive().max(300),
  objetivosRelacionados: relatedObjectiveIdsSchema,
  produtoDoEstudante: boundedString(3, 500),
  momentos: z.array(lessonMomentSchema).min(3).max(6).optional(),
}).strict();

const lessonAssessmentSchema = z.object({
  instrumento: boundedString(3, 500),
  objetivosRelacionados: relatedObjectiveIdsSchema,
  criterioSucesso: boundedString(3, 500),
}).strict();

const geminiLessonPlanSchema = z
  .object({
    titulo: boundedString(3, 200),
    resumo: boundedString(10, 1500),
    objetivos: z.array(lessonObjectiveSchema).min(1).max(10),
    metodologia: z.array(boundedString(2, 500)).min(1).max(10),
    recursos: z.array(boundedString(2, 500)).max(15),
    etapas: z.array(lessonStepSchema).min(1).max(40),
    avaliacoes: z.array(lessonAssessmentSchema).min(1).max(10),
    adaptacoes: z.array(boundedString(5, 500)).min(1).max(10),
    habilidadesBNCC: z
      .array(
        z.object({
          codigo: boundedString(2, 50),
          descricao: boundedString(2, 500),
        }).strict()
      )
      .max(5),
  })
  .strict();

// A versão JSON Schema é usada pelo structured output do SDK do Gemini.
const geminiResponseSchema = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    resumo: { type: 'string' },
    objetivos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          descricao: { type: 'string' },
          evidencia: { type: 'string' },
          criterioSucesso: { type: 'string' },
        },
        required: ['id', 'descricao', 'evidencia', 'criterioSucesso'],
      },
    },
    metodologia: { type: 'array', items: { type: 'string' } },
    recursos: { type: 'array', items: { type: 'string' } },
    etapas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          aulaNumero: { type: 'integer' },
          momento: { type: 'string' },
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          duracaoMinutos: { type: 'integer' },
          objetivosRelacionados: { type: 'array', items: { type: 'string' } },
          produtoDoEstudante: { type: 'string' },
          momentos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                duracaoMinutos: { type: 'integer' },
                descricao: { type: 'string' },
                acaoProfessor: { type: 'string' },
                acaoEstudantes: { type: 'string' },
                material: { type: 'string' },
                evidenciaProduzida: { type: 'string' },
              },
              required: [
                'tipo',
                'duracaoMinutos',
                'descricao',
                'acaoProfessor',
                'acaoEstudantes',
                'material',
                'evidenciaProduzida',
              ],
            },
          },
        },
        required: [
          'titulo',
          'descricao',
          'duracaoMinutos',
          'objetivosRelacionados',
          'produtoDoEstudante',
        ],
      },
    },
    avaliacoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          instrumento: { type: 'string' },
          objetivosRelacionados: { type: 'array', items: { type: 'string' } },
          criterioSucesso: { type: 'string' },
        },
        required: ['instrumento', 'objetivosRelacionados', 'criterioSucesso'],
      },
    },
    adaptacoes: { type: 'array', items: { type: 'string' } },
    habilidadesBNCC: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          descricao: { type: 'string' },
        },
        required: ['codigo', 'descricao'],
      },
    },
  },
  required: [
    'titulo',
    'resumo',
    'objetivos',
    'metodologia',
    'recursos',
    'etapas',
    'avaliacoes',
    'adaptacoes',
    'habilidadesBNCC',
  ],
};

function customIssue(path, message) {
  return { code: 'custom', path, message };
}

function failedValidation(issues) {
  return { success: false, error: { issues } };
}

function extractLessonNumber(step) {
  if (Number.isInteger(step.aulaNumero)) return step.aulaNumero;
  const match = `${step.titulo || ''} ${step.descricao || ''}`.match(/aula\s+(\d{1,2})/i);
  return match ? Number(match[1]) : null;
}

function validateLessonMoments(step, stepIndex, duracaoPorAula, issues) {
  if (!Array.isArray(step.momentos)) return false;
  const total = step.momentos.reduce((sum, moment) => sum + moment.duracaoMinutos, 0);
  if (total !== step.duracaoMinutos || total !== duracaoPorAula) {
    issues.push(customIssue(
      ['etapas', stepIndex, 'momentos'],
      `Os momentos da aula devem somar ${duracaoPorAula} minutos`
    ));
  }
  step.momentos.forEach((moment, momentIndex) => {
    if (duracaoPorAula > 35 && moment.duracaoMinutos > 35) {
      issues.push(customIssue(
        ['etapas', stepIndex, 'momentos', momentIndex, 'duracaoMinutos'],
        'Nenhum momento interno deve ultrapassar 35 minutos'
      ));
    }
  });
  const momentsText = step.momentos.map((moment) => `${moment.tipo} ${moment.descricao}`).join(' ');
  if (!/abertura|retomada|problematiza/i.test(momentsText)) {
    issues.push(customIssue(['etapas', stepIndex, 'momentos'], 'A aula deve conter abertura ou retomada'));
  }
  if (!/fechamento|s[ií]ntese|avalia/i.test(momentsText)) {
    issues.push(customIssue(['etapas', stepIndex, 'momentos'], 'A aula deve conter fechamento ou avaliação formativa'));
  }
  return true;
}

function validateLessonSequence(plan, options, issues) {
  const quantidadeAulas = Number(options.quantidadeAulas || 1);
  const duracaoPorAula = Number(options.duracaoPorAulaMinutos || 0);
  if (!Number.isInteger(quantidadeAulas) || quantidadeAulas <= 1 || !duracaoPorAula) return;

  const stepsByLesson = new Map();
  plan.etapas.forEach((step, stepIndex) => {
    const lessonNumber = extractLessonNumber(step);
    if (!lessonNumber || lessonNumber < 1 || lessonNumber > quantidadeAulas) {
      issues.push(customIssue(
        ['etapas', stepIndex],
        `Cada etapa deve indicar a aula correspondente entre Aula 1 e Aula ${quantidadeAulas}`
      ));
      return;
    }
    if (!stepsByLesson.has(lessonNumber)) stepsByLesson.set(lessonNumber, []);
    stepsByLesson.get(lessonNumber).push({ ...step, stepIndex });
  });

  for (let lessonNumber = 1; lessonNumber <= quantidadeAulas; lessonNumber += 1) {
    const lessonSteps = stepsByLesson.get(lessonNumber) || [];
    if (lessonSteps.length === 1 && validateLessonMoments(lessonSteps[0], lessonSteps[0].stepIndex, duracaoPorAula, issues)) {
      continue;
    }

    if (lessonSteps.length < 4) {
      issues.push(customIssue(
        ['etapas'],
        `Aula ${lessonNumber} deve ser dividida em pelo menos quatro momentos internos`
      ));
    }

    const lessonDuration = lessonSteps.reduce((sum, step) => sum + step.duracaoMinutos, 0);
    if (lessonDuration !== duracaoPorAula) {
      issues.push(customIssue(
        ['etapas'],
        `Aula ${lessonNumber} soma ${lessonDuration} minutos, mas deve somar ${duracaoPorAula}`
      ));
    }

    lessonSteps.forEach((step) => {
      if (duracaoPorAula > 35 && step.duracaoMinutos > 35) {
        issues.push(customIssue(
          ['etapas', step.stepIndex, 'duracaoMinutos'],
          'Em sequências didáticas, nenhum momento interno deve ultrapassar 35 minutos'
        ));
      }
    });

    const lessonText = lessonSteps.map((step) => `${step.titulo} ${step.descricao}`).join(' ');
    if (!/abertura|retomada|problematiza/i.test(lessonText)) {
      issues.push(customIssue(['etapas'], `Aula ${lessonNumber} deve conter abertura ou retomada`));
    }
    if (!/fechamento|s[ií]ntese|avalia/i.test(lessonText)) {
      issues.push(customIssue(['etapas'], `Aula ${lessonNumber} deve conter fechamento ou avaliação formativa`));
    }
  }
}

function validateLessonPlanContent(content, expectedDurationMinutes, options = {}) {
  const parsed = geminiLessonPlanSchema.safeParse(content);

  if (!parsed.success) {
    return parsed;
  }

  const issues = [];
  const objectiveIds = parsed.data.objetivos.map((objective) => objective.id);
  const objectiveIdSet = new Set(objectiveIds);

  if (objectiveIdSet.size !== objectiveIds.length) {
    issues.push(customIssue(['objetivos'], 'Os identificadores dos objetivos devem ser únicos'));
  }

  const stepCoverage = new Set();
  const assessmentCoverage = new Set();

  parsed.data.etapas.forEach((step, stepIndex) => {
    const references = new Set(step.objetivosRelacionados);
    if (references.size !== step.objetivosRelacionados.length) {
      issues.push(customIssue(
        ['etapas', stepIndex, 'objetivosRelacionados'],
        'Uma etapa não pode repetir o mesmo objetivo'
      ));
    }
    step.objetivosRelacionados.forEach((objectiveId) => {
      if (!objectiveIdSet.has(objectiveId)) {
        issues.push(customIssue(
          ['etapas', stepIndex, 'objetivosRelacionados'],
          `O objetivo ${objectiveId} não existe no plano`
        ));
      } else {
        stepCoverage.add(objectiveId);
      }
    });
  });

  parsed.data.avaliacoes.forEach((assessment, assessmentIndex) => {
    const references = new Set(assessment.objetivosRelacionados);
    if (references.size !== assessment.objetivosRelacionados.length) {
      issues.push(customIssue(
        ['avaliacoes', assessmentIndex, 'objetivosRelacionados'],
        'Uma avaliação não pode repetir o mesmo objetivo'
      ));
    }
    assessment.objetivosRelacionados.forEach((objectiveId) => {
      if (!objectiveIdSet.has(objectiveId)) {
        issues.push(customIssue(
          ['avaliacoes', assessmentIndex, 'objetivosRelacionados'],
          `O objetivo ${objectiveId} não existe no plano`
        ));
      } else {
        assessmentCoverage.add(objectiveId);
      }
    });
  });

  objectiveIds.forEach((objectiveId, objectiveIndex) => {
    if (!stepCoverage.has(objectiveId)) {
      issues.push(customIssue(
        ['objetivos', objectiveIndex, 'id'],
        `O objetivo ${objectiveId} deve estar associado a pelo menos uma etapa`
      ));
    }
    if (!assessmentCoverage.has(objectiveId)) {
      issues.push(customIssue(
        ['objetivos', objectiveIndex, 'id'],
        `O objetivo ${objectiveId} deve estar associado a pelo menos uma avaliação`
      ));
    }
  });

  const totalDuration = parsed.data.etapas.reduce(
    (total, etapa) => total + etapa.duracaoMinutos,
    0
  );
  const tolerance = Math.max(5, expectedDurationMinutes * 0.1);
  const lowerBound = expectedDurationMinutes - tolerance;
  const upperBound = expectedDurationMinutes + tolerance;

  if (totalDuration < lowerBound || totalDuration > upperBound) {
    issues.push(customIssue(
      ['etapas'],
      `A soma das etapas (${totalDuration} minutos) deve ficar entre ${Math.max(1, Math.ceil(lowerBound))} e ${Math.floor(upperBound)} minutos`
    ));
  }

  validateLessonSequence(parsed.data, options, issues);

  if (Array.isArray(options.allowedBnccCodes)) {
    const allowedCodes = new Set(options.allowedBnccCodes.map((code) => String(code).toUpperCase()));
    parsed.data.habilidadesBNCC.forEach((skill, skillIndex) => {
      if (!allowedCodes.has(skill.codigo.toUpperCase())) {
        issues.push(customIssue(
          ['habilidadesBNCC', skillIndex, 'codigo'],
          `O código BNCC ${skill.codigo} não pertence ao contexto recuperado`
        ));
      }
    });
  }

  const bnccCodes = parsed.data.habilidadesBNCC.map((skill) => skill.codigo.toUpperCase());
  if (new Set(bnccCodes).size !== bnccCodes.length) {
    issues.push(customIssue(['habilidadesBNCC'], 'Os códigos BNCC não podem ser repetidos'));
  }

  if (issues.length > 0) {
    return failedValidation(issues);
  }

  return parsed;
}

module.exports = {
  geminiLessonPlanSchema,
  geminiResponseSchema,
  lessonAssessmentSchema,
  lessonObjectiveSchema,
  lessonStepSchema,
  validateLessonPlanContent,
};
