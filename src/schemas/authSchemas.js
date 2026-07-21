const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número');

const registerSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(255),
    senha: passwordSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    senha: z.string().min(1).max(72),
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
};
