const { z } = require('zod');

const lessonPlanGenerationSchema = z
  .object({
    tema: z.string().trim().min(3).max(200),
    nivelEnsino: z.string().trim().min(2).max(100),
    duracaoMinutos: z.coerce.number().int().min(10).max(300),
    codigoBNCC: z
      .string()
      .trim()
      .max(50)
      .regex(/^[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{2}$/, 'Código BNCC inválido')
      .optional(),
    contextoAdicional: z.string().trim().max(1000).optional(),
  })
  .strict();

const lessonPlanListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const lessonPlanIdParamsSchema = z.object({
  id: z.string().uuid('ID do plano inválido'),
});

module.exports = {
  lessonPlanGenerationSchema,
  lessonPlanListQuerySchema,
  lessonPlanIdParamsSchema,
};
