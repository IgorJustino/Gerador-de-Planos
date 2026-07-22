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
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

module.exports = {
  bnccSearchQuerySchema,
  bnccCodeParamsSchema,
  bnccSemanticSearchSchema,
};
