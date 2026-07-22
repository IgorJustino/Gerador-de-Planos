const { z } = require('zod');

const bnccSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(50).optional(),
    subject: z.string().trim().max(120).optional(),
    educationStage: z.string().trim().max(100).optional(),
    schoolYear: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

const bnccCodeParamsSchema = z.object({
  code: z.string().trim().min(2).max(50),
});

const bnccSemanticSearchSchema = z
  .object({
    query: z.string().trim().min(3).max(500),
    subject: z.string().trim().max(120).optional(),
    educationStage: z.string().trim().max(100).optional(),
    schoolYear: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

const bnccRecommendationSchema = z
  .object({
    tema: z.string().trim().min(3).max(200),
    disciplina: z.string().trim().min(2).max(120),
    etapaEnsino: z.string().trim().min(2).max(100),
    serieAno: z.string().trim().min(1).max(50),
    limit: z.coerce.number().int().min(1).max(3).default(3),
  })
  .strict();

module.exports = {
  bnccSearchQuerySchema,
  bnccCodeParamsSchema,
  bnccSemanticSearchSchema,
  bnccRecommendationSchema,
};
