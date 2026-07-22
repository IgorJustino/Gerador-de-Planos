const { z } = require('zod');
const { geminiLessonPlanSchema } = require('./geminiSchemas');

const bnccCodePattern = /^[A-Za-z]{2}\d{2}[A-Za-z]{2,3}\d{2,3}$/;

const lessonPlanGenerationSchema = z
  .object({
    tema: z.string().trim().min(3).max(200),
    nivelEnsino: z.string().trim().min(2).max(100),
    etapaEnsino: z.string().trim().min(2).max(100).optional(),
    serieAno: z.string().trim().min(1).max(50).optional(),
    disciplina: z.string().trim().min(2).max(120).optional(),
    duracaoMinutos: z.coerce.number().int().min(10).max(300),
    quantidadeAulas: z.coerce.number().int().min(1).max(20).default(1),
    codigoBNCC: z
      .string()
      .trim()
      .max(50)
      .regex(bnccCodePattern, 'Código BNCC inválido')
      .optional(),
    bnccSkillId: z.string().uuid('Habilidade BNCC inválida').optional(),
    contextoAdicional: z.string().trim().max(1000).optional(),
  })
  .strict();

const lessonPlanListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'reviewed', 'approved', 'archived']).optional(),
    nivelEnsino: z.string().trim().min(1).max(100).optional(),
    codigoBNCC: z.string().trim().max(50).optional(),
    tema: z.string().trim().min(1).max(200).optional(),
    sort: z
      .enum(['created_desc', 'created_asc', 'updated_desc', 'updated_asc'])
      .default('created_desc'),
  })
  .strict();

const lessonPlanIdParamsSchema = z.object({
  id: z.string().uuid('ID do plano inválido'),
});

const lessonPlanVersionParamsSchema = z.object({
  id: z.string().uuid('ID do plano inválido'),
  versionNumber: z.coerce.number().int().min(1, 'Versão inválida'),
});

const editableBnccCodeSchema = z
  .string()
  .trim()
  .max(50)
  .regex(bnccCodePattern, 'Código BNCC inválido');

const lessonPlanUpdateSchema = z
  .object({
    tema: z.string().trim().min(3).max(200).optional(),
    nivelEnsino: z.string().trim().min(2).max(100).optional(),
    etapaEnsino: z.string().trim().min(2).max(100).optional(),
    serieAno: z.string().trim().min(1).max(50).optional(),
    disciplina: z.string().trim().min(2).max(120).optional(),
    duracaoMinutos: z.coerce.number().int().min(10).max(6000).optional(),
    codigoBNCC: z.union([editableBnccCodeSchema, z.null()]).optional(),
    conteudo: geminiLessonPlanSchema.optional(),
    expectedVersion: z.coerce.number().int().min(1, 'Versão esperada inválida'),
  })
  .strict()
  .superRefine((value, context) => {
    const editableFields = ['tema', 'nivelEnsino', 'duracaoMinutos', 'codigoBNCC', 'conteudo'];
    if (!editableFields.some((field) => value[field] !== undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Informe ao menos um campo para edição',
      });
    }
  });

const lessonPlanStatusSchema = z
  .object({
    status: z.enum(['draft', 'reviewed', 'approved', 'archived']),
  })
  .strict();

module.exports = {
  lessonPlanGenerationSchema,
  lessonPlanListQuerySchema,
  lessonPlanIdParamsSchema,
  lessonPlanVersionParamsSchema,
  lessonPlanUpdateSchema,
  lessonPlanStatusSchema,
};
