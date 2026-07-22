const { z } = require('zod');

const feedbackSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    useful: z.boolean(),
    usedInClass: z.boolean().nullable().optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

module.exports = {
  feedbackSchema,
};
