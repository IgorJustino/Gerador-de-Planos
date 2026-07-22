const { GoogleGenerativeAI } = require('@google/generative-ai');

const AppError = require('../utils/AppError');
const { geminiResponseSchema, validateLessonPlanContent } = require('../schemas/geminiSchemas');

function createDefaultProvider(env) {
  if (!env.geminiApiKey || !env.geminiModel) {
    return null;
  }

  const client = new GoogleGenerativeAI(env.geminiApiKey);

  return {
    async generate({ prompt, signal }) {
      const model = client.getGenerativeModel({
        model: env.geminiModel,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
        },
      });
      const result = await model.generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        },
        {
          signal,
          timeout: env.geminiTimeoutMs,
        }
      );

      return {
        content: result.response.text(),
        model: env.geminiModel,
        tokens: result.response.usageMetadata?.totalTokenCount || null,
      };
    },
  };
}

function stripJsonFence(value) {
  const text = value.trim();

  if (!text.startsWith('```')) {
    return text;
  }

  const firstLineEnd = text.indexOf('\n');
  const lastFence = text.lastIndexOf('```');
  if (firstLineEnd < 0 || lastFence <= firstLineEnd) {
    return text;
  }

  return text.slice(firstLineEnd + 1, lastFence).trim();
}

function parseProviderContent(content) {
  if (content && typeof content === 'object') {
    return content;
  }

  if (typeof content !== 'string') {
    throw new Error('Resposta sem conteúdo estruturado');
  }

  return JSON.parse(stripJsonFence(content));
}

function createAIError(message, statusCode, code, cause) {
  const error = new AppError(message, statusCode, code);
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function classifyProviderError(error) {
  if (error && error.code && error.code.startsWith('AI_')) {
    return error;
  }

  const message = String(error?.message || '').toLowerCase();
  if (error?.name === 'AbortError' || message.includes('timeout') || message.includes('aborted')) {
    return createAIError('A geração excedeu o tempo limite.', 504, 'AI_TIMEOUT', error);
  }

  if (error?.status === 429 || message.includes('quota') || message.includes('rate limit')) {
    return createAIError('O serviço de IA atingiu o limite de uso.', 429, 'AI_RATE_LIMIT', error);
  }

  return createAIError('Não foi possível gerar o plano com o serviço de IA.', 502, 'AI_PROVIDER_ERROR', error);
}

function createGeminiService({ env, provider } = {}) {
  let activeProvider = provider;

  function getProvider() {
    if (!activeProvider) {
      activeProvider = createDefaultProvider(env);
    }

    if (!activeProvider) {
      throw createAIError('Serviço de IA não configurado.', 503, 'AI_CONFIGURATION_ERROR');
    }

    return activeProvider;
  }

  async function runWithTimeout(operation, timeoutMs) {
    const controller = new AbortController();
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(createAIError('A geração excedeu o tempo limite.', 504, 'AI_TIMEOUT'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        operation(controller.signal),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateStructuredLessonPlan({
    prompt,
    expectedDurationMinutes,
    allowedBnccCodes = [],
  }) {
    const attempts = 1 + Math.min(Math.max(env.geminiMaxRetries || 0, 0), 1);
    let lastValidationError;
    const startedAt = Date.now();

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await runWithTimeout(
          (signal) => getProvider().generate({
            prompt,
            signal,
            responseSchema: geminiResponseSchema,
          }),
          env.geminiTimeoutMs
        );
        const content = parseProviderContent(result.content ?? result.data ?? result.text);
        const validation = validateLessonPlanContent(content, expectedDurationMinutes, {
          allowedBnccCodes,
        });

        if (!validation.success) {
          lastValidationError = validation.error;
          continue;
        }

        return {
          content: validation.data,
          model: result.model || env.geminiModel,
          promptVersion: result.promptVersion,
          latencyMs: Date.now() - startedAt,
          tokens: result.tokens || null,
        };
      } catch (error) {
        if (error instanceof SyntaxError || error.code === 'AI_INVALID_RESPONSE') {
          lastValidationError = error;
          continue;
        }
        throw classifyProviderError(error);
      }
    }

    const invalidResponse = createAIError(
      'O serviço de IA retornou um plano fora do formato esperado.',
      502,
      'AI_INVALID_RESPONSE'
    );
    invalidResponse.details = lastValidationError?.issues || [];
    throw invalidResponse;
  }

  return {
    generateStructuredLessonPlan,
  };
}

module.exports = {
  createGeminiService,
  parseProviderContent,
  stripJsonFence,
  classifyProviderError,
};
