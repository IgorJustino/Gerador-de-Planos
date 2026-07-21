const { z } = require('zod');

const boundedString = (min, max) => z.string().trim().min(min).max(max);

const geminiLessonPlanSchema = z
  .object({
    titulo: boundedString(3, 200),
    resumo: boundedString(10, 1500),
    objetivos: z.array(boundedString(2, 500)).min(1).max(10),
    metodologia: z.array(boundedString(2, 500)).min(1).max(10),
    recursos: z.array(boundedString(2, 500)).max(15),
    etapas: z
      .array(
        z.object({
          titulo: boundedString(2, 200),
          descricao: boundedString(2, 1000),
          duracaoMinutos: z.number().int().positive().max(300),
        }).strict()
      )
      .min(1)
      .max(12),
    avaliacao: z.array(boundedString(2, 500)).min(1).max(10),
    adaptacoes: z.array(boundedString(2, 500)).max(10),
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
    objetivos: { type: 'array', items: { type: 'string' } },
    metodologia: { type: 'array', items: { type: 'string' } },
    recursos: { type: 'array', items: { type: 'string' } },
    etapas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          duracaoMinutos: { type: 'integer' },
        },
        required: ['titulo', 'descricao', 'duracaoMinutos'],
      },
    },
    avaliacao: { type: 'array', items: { type: 'string' } },
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
    'avaliacao',
    'adaptacoes',
    'habilidadesBNCC',
  ],
};

function validateLessonPlanContent(content, expectedDurationMinutes) {
  const parsed = geminiLessonPlanSchema.safeParse(content);

  if (!parsed.success) {
    return parsed;
  }

  const totalDuration = parsed.data.etapas.reduce(
    (total, etapa) => total + etapa.duracaoMinutos,
    0
  );
  const tolerance = Math.max(5, expectedDurationMinutes * 0.1);
  const lowerBound = expectedDurationMinutes - tolerance;
  const upperBound = expectedDurationMinutes + tolerance;

  if (totalDuration < lowerBound || totalDuration > upperBound) {
    return {
      success: false,
      error: {
        issues: [{
          code: 'custom',
          path: ['etapas'],
          message: `A soma das etapas (${totalDuration} minutos) deve ficar entre ${Math.max(1, Math.ceil(lowerBound))} e ${Math.floor(upperBound)} minutos`,
        }],
      },
    };
  }

  return parsed;
}

module.exports = {
  geminiLessonPlanSchema,
  geminiResponseSchema,
  validateLessonPlanContent,
};
